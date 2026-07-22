import * as React from 'react';

export interface PageHeaderProps {
	eyebrow?: React.ReactNode;
	title: React.ReactNode;
	description?: React.ReactNode;
	actions?: React.ReactNode;
}

export default function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
	return (
		<header className="page-header">
			<div className="min-w-0 space-y-1.5">
				{eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
				<h1 className="page-title">{title}</h1>
				{description && <div className="page-description">{description}</div>}
			</div>
			{actions && <div className="page-actions">{actions}</div>}
		</header>
	);
}
