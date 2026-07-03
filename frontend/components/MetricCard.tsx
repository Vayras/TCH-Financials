'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';

export interface MetricCardProps {
	label: string;
	value: React.ReactNode;
	dotColor?: string;
	valueColor?: string;
}

export function MetricCard({ label, value, dotColor, valueColor }: MetricCardProps) {
	return (
		<Card variant="outlined" sx={{ bgcolor: 'var(--n-bg)', borderColor: 'var(--n-border)' }}>
			<CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
					{dotColor && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor }} />}
					<Typography variant="overline" sx={{ color: 'var(--n-fg-subtle)', letterSpacing: '0.04em', lineHeight: 1.2 }}>
						{label}
					</Typography>
				</Box>
				<Typography sx={{ color: valueColor ?? 'var(--n-fg)', fontSize: 22, fontWeight: 600, mt: 1, fontVariantNumeric: 'tabular-nums' }}>
					{value}
				</Typography>
			</CardContent>
		</Card>
	);
}

export default MetricCard;
