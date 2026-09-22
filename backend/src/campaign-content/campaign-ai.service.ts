import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'crypto';
import { env } from '../env';
import { CampaignActor, campaignId } from './campaign-content.model';
import { CampaignContentPolicy } from './campaign-content.policy';
import { validateConcept, uuid } from './content-concept.model';


export interface GeneratedIdea {
  title: string;
  hook: string;
  outline: string;
  script_draft: string;
  cta: string;
  rationale: string;
}

@Injectable()
export class CampaignAIService {
  constructor(private readonly db: DataSource) {}
  private policy = new CampaignContentPolicy();

  private async access(m: EntityManager, a: CampaignActor, id: string) {
    campaignId(id);
    if (a.role === 'creator') {
      const creator = await this.policy.requireCreator(m, a);
      const [assigned] = await m.query(
        'SELECT 1 FROM tch_campaign_brief_creator WHERE campaign_id=$1 AND creator_id=$2',
        [id, creator]
      );
      if (!assigned) throw new NotFoundException('Campaign brief assignment not found.');
      return creator;
    }
    throw new ForbiddenException('Only assigned creators can generate AI concept ideas.');
  }

  async generateIdeas(a: CampaignActor, id: string) {
    if (!env.openaiApiKey) {
      throw new ServiceUnavailableException('AI concept generation is not configured on this server.');
    }

    return this.db.transaction(async (m) => {
      const creatorId = await this.access(m, a, id);

      // Lock campaign and retrieve current shared brief revision
      const [brief] = await m.query(
        'SELECT b.shared_revision_id, r.content FROM tch_campaign_brief b JOIN tch_campaign_brief_revision r ON r.id=b.shared_revision_id WHERE b.campaign_id=$1',
        [id]
      );
      if (!brief || !brief.shared_revision_id) {
        throw new ConflictException('A shared campaign brief is required before generating concept ideas.');
      }

      // Check for any ongoing job for this creator and campaign
      const [existingJob] = await m.query(
        `SELECT id, status FROM tch_campaign_ai_job 
         WHERE campaign_id=$1 AND creator_id=$2 AND status IN ('pending', 'processing')
         ORDER BY created_at DESC LIMIT 1`,
        [id, creatorId]
      );
      if (existingJob) {
        throw new ConflictException('An AI generation job is already in progress for this campaign.');
      }

      // Create new PENDING job record
      const jobId = randomUUID();
      await m.query(
        `INSERT INTO tch_campaign_ai_job(id, campaign_id, brief_revision_id, creator_id, status)
         VALUES($1, $2, $3, $4, 'processing')`,
        [jobId, id, brief.shared_revision_id, creatorId]
      );

      try {
        const briefContent = typeof brief.content === 'string' ? JSON.parse(brief.content) : brief.content;

        // Fetch optional creator details for personalization
        const [creatorProfile] = await m.query(
          `SELECT name, category, notes FROM tch_creator WHERE id=$1`,
          [creatorId]
        );

        const promptSystem = `You are a world-class social media creative strategist. 
Generate 3 distinct, creative, high-converting social media content concept ideas (Reels/TikTok/Shorts) based on the brand campaign brief and creator profile provided.
You MUST output ONLY valid JSON matching this exact structure:
{
  "ideas": [
    {
      "title": "Short catchy title",
      "hook": "Strong 3-second opening visual/audio hook",
      "outline": "Step by step video flow (3-4 bullet points)",
      "script_draft": "Complete spoken word or caption script",
      "cta": "Clear call to action",
      "rationale": "Brief 1-sentence explanation of why this fits the brief & creator style"
    }
  ]
}`;

        const promptUser = `BRAND CAMPAIGN BRIEF:
- Title: ${briefContent.title || 'Untitled Campaign'}
- Objective: ${briefContent.objective || 'N/A'}
- Target Audience: ${briefContent.audience || 'N/A'}
- Key Deliverables: ${JSON.stringify(briefContent.deliverables || [])}
- Guidelines / Do Nots: ${JSON.stringify(briefContent.prohibited_claims || [])}

CREATOR PROFILE:
- Name: ${creatorProfile?.name || 'Creator'}
- Niche/category: ${creatorProfile?.category || 'General Content'}
- Notes: ${creatorProfile?.notes || 'N/A'}

Generate 3 unique, personalized ideas now in strict JSON format.`;

        // Call OpenAI API via server-side fetch
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: env.openaiModel,
            messages: [
              { role: 'system', content: promptSystem },
              { role: 'user', content: promptUser },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 2000,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`OpenAI API returned HTTP ${response.status}: ${errText.slice(0, 300)}`);
        }

        const data: any = await response.json();
        const responseText = data.choices?.[0]?.message?.content ?? '{}';

        const parsed = JSON.parse(responseText);

        const ideas: GeneratedIdea[] = Array.isArray(parsed.ideas) ? parsed.ideas : [];
        if (ideas.length === 0) {
          throw new Error('OpenAI API returned empty or invalid idea items.');
        }

        // Save generated ideas to database
        const savedIdeas = [];
        for (const idea of ideas.slice(0, 3)) {
          const ideaId = randomUUID();
          await m.query(
            `INSERT INTO tch_campaign_ai_idea(
              id, job_id, campaign_id, creator_id, title, hook, outline, script_draft, cta, rationale
            ) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              ideaId,
              jobId,
              id,
              creatorId,
              String(idea.title || 'Untitled AI Idea').trim(),
              String(idea.hook || '').trim(),
              String(idea.outline || '').trim(),
              String(idea.script_draft || '').trim(),
              String(idea.cta || '').trim(),
              String(idea.rationale || '').trim(),
            ]
          );
          savedIdeas.push({
            id: ideaId,
            job_id: jobId,
            title: idea.title,
            hook: idea.hook,
            outline: idea.outline,
            script_draft: idea.script_draft,
            cta: idea.cta,
            rationale: idea.rationale,
            is_expanded: false,
          });
        }

        // Update job status to COMPLETED
        await m.query(
          `UPDATE tch_campaign_ai_job SET status='completed', updated_at=now() WHERE id=$1`,
          [jobId]
        );

        return {
          job_id: jobId,
          status: 'completed',
          ideas: savedIdeas,
        };
      } catch (err: any) {
        const errorMsg = err.message || 'AI generation failed.';
        await m.query(
          `UPDATE tch_campaign_ai_job SET status='failed', error_message=$2, updated_at=now() WHERE id=$1`,
          [jobId, errorMsg]
        );
        // Provider/configuration failures are operational errors, not invalid user input.
        // Do not return the provider response or any key-related detail to the client.
        throw new ServiceUnavailableException('AI generation is temporarily unavailable. Check the server AI configuration and try again.');
      }
    });
  }

  async listIdeas(a: CampaignActor, id: string) {
    return this.db.transaction(async (m) => {
      const creatorId = await this.access(m, a, id);
      const ideas = await m.query(
        `SELECT id, job_id, title, hook, outline, script_draft, cta, rationale, is_expanded, created_at
         FROM tch_campaign_ai_idea
         WHERE campaign_id=$1 AND creator_id=$2
         ORDER BY created_at DESC LIMIT 10`,
        [id, creatorId]
      );
      return { ideas };
    });
  }

  async expandIdea(a: CampaignActor, id: string, ideaIdStr: string) {
    const ideaId = uuid(ideaIdStr);
    return this.db.transaction(async (m) => {
      const creatorId = await this.access(m, a, id);

      const [idea] = await m.query(
        `SELECT * FROM tch_campaign_ai_idea WHERE id=$1 AND campaign_id=$2 AND creator_id=$3`,
        [ideaId, id, creatorId]
      );
      if (!idea) throw new NotFoundException('AI Idea not found.');

      const [brief] = await m.query(
        'SELECT shared_revision_id FROM tch_campaign_brief WHERE campaign_id=$1',
        [id]
      );
      if (!brief || !brief.shared_revision_id) {
        throw new ConflictException('A shared campaign brief is required to convert ideas into drafts.');
      }

      const content = validateConcept({
        title: idea.title,
        hook: idea.hook,
        outline: idea.outline,
        script: idea.script_draft,
        cta: idea.cta,
        requirements: idea.rationale ? `AI Suggestion Rationale: ${idea.rationale}` : '',
      });

      const conceptId = randomUUID();
      const revisionId = randomUUID();

      // Create new Concept in draft state
      await m.query(
        `INSERT INTO tch_content_concept(id, campaign_id, creator_id, state, version)
         VALUES($1, $2, $3, 'draft', 1)`,
        [conceptId, id, creatorId]
      );

      // Create initial Concept Revision
      await m.query(
        `INSERT INTO tch_content_concept_revision(id, concept_id, campaign_id, brief_revision_id, content, created_by)
         VALUES($1, $2, $3, $4, $5, $6)`,
        [revisionId, conceptId, id, brief.shared_revision_id, JSON.stringify(content), a.id]
      );

      // Link current revision & mark AI idea as expanded
      await m.query(
        `UPDATE tch_content_concept SET current_revision=$2 WHERE id=$1`,
        [conceptId, revisionId]
      );
      await m.query(
        `UPDATE tch_campaign_ai_idea SET is_expanded=true WHERE id=$1`,
        [ideaId]
      );

      return {
        concept_id: conceptId,
        revision_id: revisionId,
        version: 1,
        message: 'AI idea expanded into editable concept draft.',
      };
    });
  }
}
