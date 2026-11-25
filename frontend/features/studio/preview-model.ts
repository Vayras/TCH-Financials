export type MediaKind = 'image' | 'video';
export type PreviewRequest = {
  kind: MediaKind;
  prompt: string;
  duration: number;
  ratio: string;
};
export type PreviewAsset = {
  id: string;
  projectId: string;
  kind: MediaKind;
  title: string;
  prompt: string;
  ratio: string;
  duration?: number;
  resolution: string;
  src: string;
  poster: string;
  mediaRatio: string;
  reference?: { id: string; title: string; src: string };
  presetId?: string;
};

export type StudioDraft = PreviewRequest & {
  resolution: string;
  referenceId: string;
  presetId?: string;
};
export type PreviewJob = PreviewRequest & {
  projectId: string;
  resolution: string;
  presetId?: string;
  reference?: PreviewAsset['reference'];
};
export const DEFAULT_STUDIO_DRAFT: StudioDraft = {
  kind: 'image',
  prompt: '',
  duration: 5,
  ratio: '9:16',
  resolution: '720p',
  referenceId: '',
};
export const PREVIEW_PRESETS = [
  {
    id: 'product',
    label: 'Product spotlight',
    description: 'Warm light. A little drama.',
    src: '/studio/amber.svg',
    ratio: '9:16',
    prompt:
      'An amber perfume bottle on a stone pedestal, warm afternoon light, soft botanical shadows, editorial product photography.',
  },
  {
    id: 'lifestyle',
    label: 'The daily ritual',
    description: 'Natural textures, softer moments.',
    src: '/studio/matcha.svg',
    ratio: '9:16',
    prompt:
      'A quiet morning ritual with matcha, natural materials and soft window light. Calm, intentional, earthy green tones.',
  },
  {
    id: 'coastal',
    label: 'Cinematic escape',
    description: 'Wide frames. Room to breathe.',
    src: '/studio/coast.svg',
    ratio: '16:9',
    prompt:
      'A slow cinematic journey along a quiet coastline at sunrise, gentle waves, muted teal water and warm sand.',
  },
];

export function applyPreviewPreset(draft: StudioDraft, presetId: string): StudioDraft {
  const preset = PREVIEW_PRESETS.find((item) => item.id === presetId);
  return preset ? { ...draft, prompt: preset.prompt, ratio: preset.ratio, presetId } : draft;
}

export function getPreviewReference<T extends { id: string; projectId: string; kind: string }>(
  assets: T[],
  projectId: string,
  assetId: string,
): T | null {
  return (
    assets.find(
      (asset) => asset.id === assetId && asset.projectId === projectId && asset.kind === 'image',
    ) ?? null
  );
}

export function completePreviewJob(job: PreviewJob, id: string): PreviewAsset {
  const preset = PREVIEW_PRESETS.find((item) => item.id === job.presetId) ?? PREVIEW_PRESETS[0];
  const video = job.kind === 'video';
  return {
    id,
    projectId: job.projectId,
    kind: job.kind,
    title:
      job.prompt
        .trim()
        .split(/[.!?\n]/)[0]
        .slice(0, 64) || 'Untitled study',
    prompt: job.prompt,
    ratio: job.ratio,
    resolution: video ? job.resolution : '1024px',
    duration: video ? job.duration : undefined,
    src: video ? '/studio/botanical-sample.mp4' : preset.src,
    poster: video ? '' : preset.src,
    mediaRatio: video ? '16:9' : preset.id === 'coastal' ? '8:5' : '5:6',
    reference: job.reference ? { ...job.reference } : undefined,
    presetId: job.presetId,
  };
}

export function samplePreviewAssets(projectId: string): PreviewAsset[] {
  const images = PREVIEW_PRESETS.map((preset) => ({
    ...completePreviewJob(
      {
        ...DEFAULT_STUDIO_DRAFT,
        projectId,
        presetId: preset.id,
        prompt: preset.prompt,
        ratio: preset.ratio,
      },
      `${projectId}-${preset.id}`,
    ),
    title: preset.label,
  }));
  const video = {
    ...completePreviewJob(
      {
        ...DEFAULT_STUDIO_DRAFT,
        projectId,
        kind: 'video',
        ratio: '16:9',
        prompt:
          'A close-up botanical study with soft natural movement and a shallow depth of field.',
      },
      `${projectId}-video`,
    ),
    title: 'A moment in bloom',
  };
  return [images[0], video, images[1], images[2]];
}

export function validatePreviewRequest(request: PreviewRequest): string | null {
  if (!request.prompt.trim()) return 'Describe what you want to create first.';
  if (request.prompt.length > 4000) return 'Use at most 4,000 characters.';
  if (!['1:1', '9:16', '16:9'].includes(request.ratio)) return 'Choose a supported format.';
  if (request.kind === 'video' && ![5, 10].includes(request.duration))
    return 'Choose a supported duration.';
  return null;
}

export function filterPreviewAssets<T extends Pick<PreviewAsset, 'projectId' | 'kind' | 'title'>>(
  assets: T[],
  projectId: string,
  kind: MediaKind | 'all',
  search: string,
): T[] {
  const query = search.trim().toLowerCase();
  return assets.filter(
    (asset) =>
      asset.projectId === projectId &&
      (kind === 'all' || asset.kind === kind) &&
      asset.title.toLowerCase().includes(query),
  );
}
