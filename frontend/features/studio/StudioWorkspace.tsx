'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronRight,
  Clapperboard,
  FolderOpen,
  Images,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Search,
  Sparkles,
  Video,
  WandSparkles,
} from 'lucide-react';
import { useAuth } from '@/components/AuthGuard';
import Dialog from '@/components/ui/Dialog';
import StudioComposer from './StudioComposer';
import StudioAssetGrid from './StudioAssetGrid';
import {
  applyPreviewPreset,
  completePreviewJob,
  DEFAULT_STUDIO_DRAFT,
  filterPreviewAssets,
  getPreviewReference,
  PREVIEW_PRESETS,
  samplePreviewAssets,
  validatePreviewRequest,
  type MediaKind,
  type PreviewAsset,
  type PreviewJob,
  type StudioDraft,
} from './preview-model';
import styles from './StudioWorkspace.module.css';

type CampaignContext = { id: string; name: string; brand: string; objective?: string };
type Project = { id: string; name: string; campaign?: CampaignContext };
const demoCampaign: CampaignContext = {
  id: 'demo',
  name: 'A slower kind of summer',
  brand: 'Sample campaign',
  objective:
    'Introduce a mindful daily ritual through warm, natural product storytelling. Keep the product at the centre of the story.',
};

export default function StudioWorkspace({ campaign }: { campaign?: CampaignContext }) {
  const { email, creatorId } = useAuth();
  return (
    <Workspace key={`${email}:${creatorId}:${campaign?.id ?? 'standalone'}`} campaign={campaign} />
  );
}

function Workspace({ campaign }: { campaign?: CampaignContext }) {
  const initialProject: Project = campaign
    ? { id: `campaign-${campaign.id}`, name: campaign.name, campaign }
    : { id: 'personal', name: 'Personal workspace' };
  const [projects, setProjects] = useState<Project[]>(() =>
    campaign
      ? [initialProject]
      : [
          initialProject,
          { id: 'sample-campaign', name: demoCampaign.name, campaign: demoCampaign },
        ],
  );
  const [projectId, setProjectId] = useState(initialProject.id);
  const [drafts, setDrafts] = useState<Record<string, StudioDraft>>({});
  const draft = drafts[projectId] ?? DEFAULT_STUDIO_DRAFT;
  const project = projects.find((item) => item.id === projectId)!;
  const [assets, setAssets] = useState<PreviewAsset[]>(() =>
    projects.flatMap((item) => samplePreviewAssets(item.id)),
  );
  const [filter, setFilter] = useState<MediaKind | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PreviewAsset | null>(null);
  const [job, setJob] = useState<PreviewJob | null>(null);
  const [notice, setNotice] = useState<{ projectId: string; text: string } | null>(null);
  const [error, setError] = useState('');
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const ownAssets = assets.filter((asset) => asset.projectId === projectId);
  const visible = filterPreviewAssets(assets, projectId, filter, search);

  function updateDraft(patch: Partial<StudioDraft>) {
    setDrafts((current) => ({
      ...current,
      [projectId]: { ...(current[projectId] ?? DEFAULT_STUDIO_DRAFT), ...patch },
    }));
    setError('');
  }
  function selectMode(kind: MediaKind) {
    updateDraft({ kind, ...(kind === 'image' ? { referenceId: '' } : {}) });
    setFilter(kind);
  }
  function changeProject(id: string) {
    setProjectId(id);
    setSelected(null);
    setError('');
    setSearch('');
    setFilter((drafts[id] ?? DEFAULT_STUDIO_DRAFT).kind);
  }
  useEffect(() => {
    if (!job) return;
    // ponytail: one mounted sample job; replace the timer with server polling in the backend phase.
    const timer = window.setTimeout(() => {
      setAssets((current) => [completePreviewJob(job, crypto.randomUUID()), ...current]);
      setNotice({
        projectId: job.projectId,
        text: 'Sample preview ready. Your request is recorded; this is not an AI-generated output.',
      });
      setJob(null);
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [job]);

  function generate(event: FormEvent) {
    event.preventDefault();
    if (job) return;
    const reference =
      draft.kind === 'video' && draft.referenceId
        ? getPreviewReference(assets, projectId, draft.referenceId)
        : null;
    const issue =
      validatePreviewRequest(draft) ??
      (draft.kind === 'video' && draft.referenceId && !reference
        ? 'Choose an image from this workspace.'
        : null);
    setError(issue ?? '');
    if (issue) {
      promptRef.current?.focus();
      return;
    }
    setNotice(null);
    setSearch('');
    setFilter(draft.kind);
    setJob({
      ...draft,
      projectId,
      prompt: draft.prompt.trim(),
      reference: reference
        ? { id: reference.id, title: reference.title, src: reference.src }
        : undefined,
    });
  }
  function reuse(asset: PreviewAsset) {
    const reference = asset.reference && getPreviewReference(assets, projectId, asset.reference.id);
    updateDraft({
      kind: asset.kind,
      prompt: asset.prompt,
      ratio: asset.ratio,
      duration: asset.duration ?? 5,
      resolution: asset.kind === 'video' ? asset.resolution : '720p',
      referenceId: reference?.id ?? '',
      presetId: asset.presetId,
    });
    setFilter(asset.kind);
    setSelected(null);
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }
  function animateImage(asset: PreviewAsset) {
    if (!getPreviewReference(assets, projectId, asset.id)) return;
    updateDraft({
      kind: 'video',
      referenceId: asset.id,
      prompt: `A slow cinematic reveal. ${asset.prompt}`,
      ratio: asset.ratio,
      presetId: asset.presetId,
    });
    setFilter('video');
    setSelected(null);
    window.setTimeout(() => promptRef.current?.focus(), 0);
  }

  return (
    <div className={styles.studio} data-mode={draft.kind}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.mark}>
            <Sparkles size={19} />
          </span>
          <h1>AI Studio</h1>
          <span className={styles.previewBadge}>Sample preview</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.private}>
            <LockKeyhole size={12} />
            Private
          </span>
          {!campaign && (
            <button className={styles.secondaryButton} onClick={() => setNewProjectOpen(true)}>
              <Plus size={14} />
              New project
            </button>
          )}
        </div>
      </header>
      <div className={styles.workspaceBar}>
        <div className={styles.projectPicker}>
          <FolderOpen size={14} />
          <label className={styles.srOnly} htmlFor="studio-project">
            Workspace
          </label>
          <select
            id="studio-project"
            value={projectId}
            onChange={(event) => changeProject(event.target.value)}
          >
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <span className={styles.scope}>{project.campaign ? 'Campaign' : 'Standalone'}</span>
        </div>
        <div className={styles.modeSwitch} role="group" aria-label="Media type">
          <button aria-pressed={draft.kind === 'image'} onClick={() => selectMode('image')}>
            <Images size={15} />
            Images
          </button>
          <button aria-pressed={draft.kind === 'video'} onClick={() => selectMode('video')}>
            <Video size={15} />
            Video
          </button>
        </div>
      </div>
      {project.campaign && (
        <details className={styles.brief}>
          <summary>
            <span>
              <Clapperboard size={14} />
              {project.campaign.brand}
              <ChevronRight size={12} />
              Campaign brief
            </span>
            <span>View context</span>
          </summary>
          <p>
            {project.campaign.objective || 'Use the campaign brief as your creative direction.'}
          </p>
          <small>{campaign ? 'Campaign brief context' : 'Sample campaign for this preview'}</small>
        </details>
      )}
      <div className={styles.workbench}>
        <div className={styles.composerSlot}>
          <StudioComposer
            draft={draft}
            onChange={updateDraft}
            onSubmit={generate}
            busy={Boolean(job)}
            error={error}
            assets={ownAssets}
            promptRef={promptRef}
          />
        </div>
        <section className={styles.canvas} aria-label="Workspace library">
          <div className={styles.canvasHeading}>
            <div>
              <span className={styles.eyebrow}>SAMPLE GALLERY</span>
              <h2>
                {draft.kind === 'image' ? 'Explore image ideas.' : 'Explore video ideas.'}
              </h2>
            </div>
            <span className={styles.count}>{ownAssets.length} samples</span>
          </div>
          <div className={styles.presetHeading}>
            <span>Start with a direction</span>
            <span>Editable prompt presets</span>
          </div>
          <div className={styles.presets}>
            {PREVIEW_PRESETS.map((preset) => (
              <button
                key={preset.id}
                aria-pressed={draft.presetId === preset.id}
                onClick={() => {
                  updateDraft(applyPreviewPreset(draft, preset.id));
                  promptRef.current?.focus();
                }}
              >
                <Image src={preset.src} alt="" width={64} height={74} unoptimized />
                <span>
                  <strong>{preset.label}</strong>
                  <small>{preset.description}</small>
                </span>
                <ArrowUpRight size={13} />
              </button>
            ))}
          </div>
          <div className={styles.libraryToolbar}>
            <div className={styles.filters} role="group" aria-label="Filter assets">
              {(['all', 'image', 'video'] as const).map((value) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {value === 'all' ? 'All creations' : value === 'image' ? 'Images' : 'Videos'}
                </button>
              ))}
            </div>
            <label className={styles.search}>
              <Search size={13} />
              <input
                aria-label="Search assets"
                placeholder="Search creations"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.notice} aria-live="polite">
            {notice?.projectId === projectId && (
              <p>
                <Check size={14} />
                {notice.text}
              </p>
            )}
          </div>
          {job && (
            <div className={styles.job} role="status">
              <LoaderCircle className={styles.spin} size={19} />
              <div>
                <strong>
                  {job.projectId === projectId
                    ? 'Preparing your sample preview'
                    : 'A preview is running in another workspace'}
                </strong>
                <p>
                  {job.kind === 'image' ? 'Image' : 'Video'} · {job.ratio} requested · simulated
                </p>
              </div>
              <button
                onClick={() => {
                  setNotice({
                    projectId: job.projectId,
                    text: 'Preview cancelled. No asset was created.',
                  });
                  setJob(null);
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <StudioAssetGrid
            assets={visible}
            onOpen={setSelected}
            filtered={Boolean(search) || filter !== 'all'}
            onClear={() => {
              setSearch('');
              setFilter('all');
            }}
          />
          <p className={styles.libraryFoot}>
            <LockKeyhole size={11} />
            Sample artwork and CC0 footage · only in this preview session
          </p>
        </section>
      </div>
      <Dialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        title="Start a new project"
        description="A separate space for your ideas. Preview projects reset when you leave."
      >
        <form
          className={styles.projectForm}
          onSubmit={(event) => {
            event.preventDefault();
            if (!projectName.trim()) return;
            const id = crypto.randomUUID();
            setProjects((current) => [...current, { id, name: projectName.trim() }]);
            changeProject(id);
            setProjectName('');
            setNewProjectOpen(false);
          }}
        >
          <label htmlFor="studio-project-name">Project name</label>
          <input
            id="studio-project-name"
            autoFocus
            required
            maxLength={80}
            placeholder="e.g. My next brand story"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
          />
          <button className={styles.generate} disabled={!projectName.trim()}>
            <Plus size={14} />
            Create preview project
          </button>
        </form>
      </Dialog>
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? 'Asset preview'}
        description="Sample media. The prompt and settings describe the request, not a real AI render."
        className={styles.assetDialog}
      >
        {selected && (
          <div className={styles.detail}>
            <div className={styles.detailMedia}>
              {selected.kind === 'image' ? (
                <Image
                  src={selected.src}
                  alt={selected.title}
                  width={1000}
                  height={1200}
                  unoptimized
                />
              ) : (
                <video
                  key={selected.id}
                  src={selected.src}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={selected.title}
                />
              )}
            </div>
            <div className={styles.detailBody}>
              <div className={styles.detailMeta}>
                <span>
                  {selected.kind === 'image' ? 'Sample illustration' : 'CC0 video sample'}
                </span>
                <span>{selected.mediaRatio} actual sample</span>
              </div>
              <h3>Submitted request</h3>
              <p>{selected.prompt}</p>
              <div className={styles.requestSettings}>
                <span>{selected.ratio} format</span>
                <span>{selected.resolution}</span>
                {selected.duration && <span>{selected.duration}s requested</span>}
              </div>
              {selected.reference && (
                <div className={styles.savedReference}>
                  <Image
                    src={selected.reference.src}
                    alt="Reference image"
                    width={42}
                    height={42}
                    unoptimized
                  />
                  <span>
                    Reference<strong>{selected.reference.title}</strong>
                  </span>
                </div>
              )}
              <p className={styles.detailDisclaimer}>
                Preview results reuse sample media. Selected formats, reference images and duration
                are not applied to the sample file.
              </p>
              <div className={styles.detailActions}>
                <button className={styles.secondaryButton} onClick={() => reuse(selected)}>
                  <WandSparkles size={14} />
                  Reuse prompt
                </button>
                {selected.kind === 'image' && (
                  <button className={styles.secondaryButton} onClick={() => animateImage(selected)}>
                    <Video size={14} />
                    Use as video reference
                  </button>
                )}
                <a
                  className={styles.download}
                  href={selected.src}
                  download={selected.kind === 'image' ? 'studio-sample.svg' : 'studio-sample.mp4'}
                >
                  <ArrowDownToLine size={14} />
                  Download sample
                </a>
              </div>
              {project.campaign && (
                <p className={styles.detailDisclaimer}>
                  Campaign submission and approvals come with the backend phase.
                </p>
              )}
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
