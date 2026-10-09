import type { BriefContent } from './types';

export default function BriefView({ content }: { content: BriefContent }) {
  return (
    <article className="space-y-6 rounded-2xl border border-[var(--n-border)] bg-white p-6 shadow-sm">
      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {content.objective && (
          <div className="rounded-xl bg-[#FAF9F5] p-4 border border-[var(--n-border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Objective</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed font-medium text-gray-900">
              {content.objective}
            </p>
          </div>
        )}

        {content.audience && (
          <div className="rounded-xl bg-[#FAF9F5] p-4 border border-[var(--n-border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Target Audience</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.audience}
            </p>
          </div>
        )}

        {content.product_context && (
          <div className="rounded-xl bg-[#FAF9F5] p-4 border border-[var(--n-border)] md:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">About the Product</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.product_context}
            </p>
          </div>
        )}

        {content.creative_direction && (
          <div className="rounded-xl bg-[#FAF9F5] p-4 border border-[var(--n-border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Creative Direction</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
              {content.creative_direction}
            </p>
          </div>
        )}

        {content.call_to_action && (
          <div className="rounded-xl bg-[#FAF9F5] p-4 border border-[var(--n-border)]">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Call to Action</h3>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 font-medium">
              {content.call_to_action}
            </p>
          </div>
        )}
      </div>

      {/* Deliverables Grid */}
      {content.deliverables.length > 0 && (
        <div className="border-t border-[var(--n-border)] pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Key Deliverables</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {content.deliverables.map((d) => (
              <div key={d.id} className="rounded-xl border border-[var(--n-border)] bg-white p-3.5 text-sm shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    {d.quantity} × {d.format || 'Deliverable'}
                  </span>
                  <span className="text-xs bg-amber-100 text-amber-900 font-medium px-2.5 py-0.5 rounded-full">
                    {d.platform}
                  </span>
                </div>
                {d.due_date && <p className="mt-1 text-xs text-gray-500">Due {d.due_date}</p>}
                {d.specifications && <p className="mt-2 text-xs text-gray-600 line-clamp-2">{d.specifications}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory & Prohibited Rules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[var(--n-border)] pt-5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Mandatory Messages</h3>
          {content.no_mandatory_messages ? (
            <p className="mt-1.5 text-xs text-gray-500">None required.</p>
          ) : (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-gray-700">
              {content.mandatory_messages.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          )}
        </div>

        {content.prohibited_claims.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-rose-700">Avoid / Do Nots</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-gray-700">
              {content.prohibited_claims.map((v, i) => (
                <li key={i}>{v}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Meta Pills */}
      {(content.languages.length > 0 || content.tags.length > 0 || content.references.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--n-border)] pt-4 text-xs">
          {content.languages.map((lang) => (
            <span key={lang} className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md">
              🌐 {lang}
            </span>
          ))}
          {content.tags.map((tag) => (
            <span key={tag} className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md">
              #{tag}
            </span>
          ))}
          {content.references.map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-amber-50 text-amber-800 hover:underline px-2.5 py-1 rounded-md"
            >
              🔗 {r.label || 'Reference'} ↗
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

