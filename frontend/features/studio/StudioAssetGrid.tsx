'use client';
import Image from 'next/image';
import { ArrowUpRight, Images, Play, Video } from 'lucide-react';
import type { PreviewAsset } from './preview-model';
import styles from './StudioWorkspace.module.css';

export function ReferencePicker({
  assets,
  selectedId,
  onSelect,
}: {
  assets: PreviewAsset[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.referenceGrid} role="group" aria-label="Choose a reference image">
      {assets
        .filter((asset) => asset.kind === 'image')
        .map((asset) => (
          <button
            type="button"
            key={asset.id}
            aria-label={`Use ${asset.title} as reference`}
            aria-pressed={selectedId === asset.id}
            onClick={() => onSelect(asset.id)}
          >
            <Image src={asset.src} alt="" width={96} height={96} unoptimized />
            <span>{asset.title}</span>
          </button>
        ))}
      {!assets.some((asset) => asset.kind === 'image') && (
        <p>Create an image in this workspace first.</p>
      )}
    </div>
  );
}
export default function StudioAssetGrid({
  assets,
  onOpen,
  onClear,
  filtered,
}: {
  assets: PreviewAsset[];
  onOpen: (asset: PreviewAsset) => void;
  onClear: () => void;
  filtered: boolean;
}) {
  if (!assets.length)
    return (
      <div className={styles.empty}>
        <Images size={30} />
        <h3>{filtered ? 'No matching creations' : 'Your next idea starts here.'}</h3>
        <p>
          {filtered
            ? 'Try another search or show all media.'
            : 'Choose a starting point or describe a scene to create a sample preview.'}
        </p>
        {filtered && (
          <button className={styles.secondaryButton} onClick={onClear}>
            Clear filters
          </button>
        )}
      </div>
    );
  return (
    <div className={styles.assetGrid}>
      {assets.map((asset) => (
        <button
          className={styles.asset}
          key={asset.id}
          onClick={() => onOpen(asset)}
          aria-label={`Open ${asset.title}`}
        >
          <div
            className={styles.assetVisual}
            style={{ aspectRatio: asset.mediaRatio.replace(':', '/') }}
          >
            {asset.kind === 'image' ? (
              <Image
                src={asset.src}
                alt={asset.title}
                fill
                sizes="(max-width: 700px) 90vw, 33vw"
                unoptimized
              />
            ) : (
              <>
                <video src={asset.src} muted preload="metadata" aria-hidden="true" />
                <span className={styles.play}>
                  <Play size={20} fill="currentColor" />
                </span>
              </>
            )}
            <span className={styles.assetSample}>SAMPLE</span>
            <span className={styles.assetType}>
              {asset.kind === 'image' ? <Images size={12} /> : <Video size={12} />}
              {asset.kind === 'video' ? '5s sample' : 'Illustration'}
            </span>
            <span className={styles.openAsset}>
              <ArrowUpRight size={17} />
            </span>
          </div>
          <div className={styles.assetCaption}>
            <strong>{asset.title}</strong>
            <span>
              {asset.kind === 'image' ? 'Image' : 'Video'}
              <i />
              {asset.mediaRatio} sample
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
