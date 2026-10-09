'use client';

import * as React from 'react';

export type CreatorSocial = {
	id: string;
	platform: 'Instagram' | 'YouTube' | 'TikTok' | 'Other';
	handle: string;
	profileUrl: string;
	followers: number;
	engagementRate: number;
	averageViews: number;
	lastUpdated: string;
};

export type PortfolioItem = {
	id: string;
	brand: string;
	title: string;
	format: string;
	metric: string;
	contentUrl: string;
	featured: boolean;
};

export type BrandEnquiry = {
	id: string;
	brand: string;
	contactName: string;
	email: string;
	brief: string;
	budget: string;
	status: 'New' | 'Reviewing' | 'Replied' | 'Closed';
	receivedAt: string;
};

export type CreatorWorkspace = {
	profile: {
		headline: string;
		bio: string;
		category: string;
		location: string;
		languages: string;
		avatarUrl: string;
		coverUrl: string;
	};
	socials: CreatorSocial[];
	portfolio: PortfolioItem[];
	mediaKit: {
		slug: string;
		status: 'Draft' | 'Published';
		accent: string;
		showAbout: boolean;
		showSocials: boolean;
		showPortfolio: boolean;
		showRates: boolean;
		showContact: boolean;
	};
	enquiries: BrandEnquiry[];
};

const STORAGE_KEY = 'tch-creator-workspace-v1';

export const DEFAULT_CREATOR_WORKSPACE: CreatorWorkspace = {
	profile: {
		headline: 'Creator, storyteller and digital entrepreneur',
		bio: '',
		category: 'Lifestyle · Technology',
		location: 'Mumbai, India',
		languages: 'English, Hindi',
		avatarUrl: '',
		coverUrl: '',
	},
	socials: [{
		id: 'instagram-primary',
		platform: 'Instagram',
		handle: '@075kapildadhich',
		profileUrl: 'https://www.instagram.com/075kapildadhich',
		followers: 1454,
		engagementRate: 5.66,
		averageViews: 191831,
		lastUpdated: '2026-09-08',
	}],
	portfolio: [],
	mediaKit: {
		slug: 'dev-creator',
		status: 'Draft',
		accent: '#441151',
		showAbout: true,
		showSocials: true,
		showPortfolio: true,
		showRates: false,
		showContact: true,
	},
	enquiries: [],
};

function readWorkspace(): CreatorWorkspace {
	if (typeof window === 'undefined') return DEFAULT_CREATOR_WORKSPACE;
	try {
		const saved = window.localStorage.getItem(STORAGE_KEY);
		if (!saved) return DEFAULT_CREATOR_WORKSPACE;
		const parsed = JSON.parse(saved) as Partial<CreatorWorkspace>;
		return {
			...DEFAULT_CREATOR_WORKSPACE,
			...parsed,
			profile: { ...DEFAULT_CREATOR_WORKSPACE.profile, ...parsed.profile },
			mediaKit: { ...DEFAULT_CREATOR_WORKSPACE.mediaKit, ...parsed.mediaKit },
			socials: parsed.socials ?? DEFAULT_CREATOR_WORKSPACE.socials,
			portfolio: parsed.portfolio ?? DEFAULT_CREATOR_WORKSPACE.portfolio,
			enquiries: parsed.enquiries ?? DEFAULT_CREATOR_WORKSPACE.enquiries,
		};
	} catch {
		return DEFAULT_CREATOR_WORKSPACE;
	}
}

export function useCreatorWorkspace() {
	const [workspace, setWorkspace] = React.useState<CreatorWorkspace>(DEFAULT_CREATOR_WORKSPACE);
	const [ready, setReady] = React.useState(false);

	React.useEffect(() => {
		setWorkspace(readWorkspace());
		setReady(true);
	}, []);

	const updateWorkspace = React.useCallback((update: CreatorWorkspace | ((current: CreatorWorkspace) => CreatorWorkspace)) => {
		setWorkspace((current) => {
			const next = typeof update === 'function' ? update(current) : update;
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			return next;
		});
	}, []);

	return { workspace, updateWorkspace, ready };
}

export function compactNumber(value: number) {
	return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}
