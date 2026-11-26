'use client';
import { useRef, type FormEvent, type RefObject } from 'react';
import Image from 'next/image';
import {
  ArrowUp,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type { PreviewAsset, StudioDraft } from './preview-model';
import { ReferencePicker } from './StudioAssetGrid';
import styles from './StudioWorkspace.module.css';

export default function StudioComposer({
  draft,
  onChange,
  onSubmit,
  busy,
  error,
  assets,
  promptRef,
}: {
  draft: StudioDraft;
  onChange: (patch: Partial<StudioDraft>) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  error: string;
  assets: PreviewAsset[];
  promptRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const referencePickerRef = useRef<HTMLDetailsElement>(null);
  const reference = assets.find(
    (asset) => asset.id === draft.referenceId && asset.kind === 'image',
  );
  return (
    <form className={styles.composer} onSubmit={onSubmit} aria-label={`Create ${draft.kind}`}>
      <div className={styles.composerTitle}>
        <span>
          <Sparkles size={15} />
          {draft.kind === 'image' ? 'Create an image' : 'Create a video'}
        </span>
      </div>
      {draft.kind === 'video' && (
        <div className={styles.referenceArea}>
          <div className={styles.referenceHeading}>
            <span>
              <ImagePlus size={14} /> Starting image <small>Optional</small>
            </span>
            {reference && (
              <button
                type="button"
                aria-label="Remove reference image"
                onClick={() => onChange({ referenceId: '' })}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {reference && (
            <div className={styles.selectedReference}>
              <Image src={reference.src} alt={reference.title} width={38} height={38} unoptimized />
              <span>
                <strong>{reference.title}</strong>
                <small>Starting image</small>
              </span>
            </div>
          )}
          <details ref={referencePickerRef} className={styles.referenceDetails}>
            <summary>
              {reference ? 'Change reference' : 'Choose from this workspace'}
              <ChevronDown size={13} />
            </summary>
            <ReferencePicker
              assets={assets}
              selectedId={draft.referenceId}
              onSelect={(id) => {
                onChange({ referenceId: id });
                referencePickerRef.current?.removeAttribute('open');
              }}
            />
          </details>
        </div>
      )}
      <label className={styles.srOnly} htmlFor="studio-prompt">
        Describe your scene
      </label>
      <textarea
        ref={promptRef}
        id="studio-prompt"
        value={draft.prompt}
        onChange={(event) => onChange({ prompt: event.target.value, presetId: undefined })}
        maxLength={4000}
        placeholder={
          draft.kind === 'image'
            ? 'Describe the scene you imagine. The subject, the light, the little details…'
            : 'Describe the movement. A slow push in, a gentle orbit, a cinematic reveal…'
        }
        aria-invalid={Boolean(error)}
        aria-describedby="studio-prompt-help"
      />
      <div className={styles.promptMeta}>
        <span id="studio-prompt-help">
          {reference
            ? 'Reference applies to this preview only.'
            : 'This sample preview won’t generate an image yet.'}
        </span>
        <span>{draft.prompt.length} / 4,000</span>
      </div>
      <div className={styles.composerBottom}>
        <div className={styles.settingControls}>
          <span className={styles.modelChip}>
            <Sparkles size={12} />
            {draft.kind === 'image' ? 'Image' : 'Video'} model <span>Not connected</span>
          </span>
          <label>
            <span className={styles.srOnly}>Aspect ratio</span>
            <select
              aria-label="Aspect ratio"
              value={draft.ratio}
              onChange={(event) => onChange({ ratio: event.target.value })}
            >
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="16:9">16:9</option>
            </select>
          </label>
          {draft.kind === 'video' ? (
            <>
              <label>
                <span className={styles.srOnly}>Duration</span>
                <select
                  aria-label="Duration"
                  value={draft.duration}
                  onChange={(event) => onChange({ duration: Number(event.target.value) })}
                >
                  <option value={5}>5 seconds</option>
                  <option value={10}>10 seconds</option>
                </select>
              </label>
              <label>
                <span className={styles.srOnly}>Resolution</span>
                <select
                  aria-label="Resolution"
                  value={draft.resolution}
                  onChange={(event) => onChange({ resolution: event.target.value })}
                >
                  <option value="720p">720p</option>
                  <option value="1080p">1080p</option>
                </select>
              </label>
            </>
          ) : (
            <span className={styles.settingChip}>
              <SlidersHorizontal size={12} />
              1024px preview
            </span>
          )}
        </div>
        <button className={styles.generate} disabled={busy} type="submit">
          {busy ? <LoaderCircle className={styles.spin} size={15} /> : <ArrowUp size={16} />}
          <span>{busy ? 'Creating preview…' : 'Generate preview'}</span>
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
