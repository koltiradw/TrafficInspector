import type { ThemeOptions } from "@mui/material/styles";

const FONT_FAMILY = "sans-serif";

export const COLORS = {
	bg: "#0d0f12",
	"off-bg": "#1a191b",
	accent: "#766ac8",
	secondary: "#9C27B0",
	white: "#f5f5f5",
	"off-white": "#faf0e6",
	grey: "#aba9a6",
	error: "#FF3B3B",
	disabled: "#504e4b",
	"nav-bg": "#f1f1f1",
};

const theme: ThemeOptions = {
	palette: {
		background: { default: COLORS.bg, paper: COLORS.disabled },
		primary: {
			dark: COLORS.accent,
			contrastText: COLORS.accent,
			light: COLORS.accent,
			main: COLORS.accent,
		},
		text: {
			primary: COLORS["off-white"],
			secondary: COLORS.white,
			disabled: COLORS.disabled,
			grey: COLORS.grey,
			error: COLORS.error,
		},
	},
	typography: {
		base: {
			fontWeight: 400,
			fontSize: "0.875rem",
			lineHeight: 1.15,
			letterSpacing: "1.15px",
			margin: 0,
			color: COLORS["off-white"],
			fontFamily: FONT_FAMILY,
		},
		baseXl: {
			fontWeight: 400,
			fontSize: "1rem",
			lineHeight: 1.15,
			letterSpacing: "1.15px",
			margin: 0,
			color: COLORS["off-white"],
			fontFamily: FONT_FAMILY,
		},
		navTitle: {
			fontWeight: 700,
			letterSpacing: "0.15rem",
			fontSize: "1.5rem",
			margin: 0,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap",
			fontFamily: "monospace",
		},
		navLink: {
			fontFamily: FONT_FAMILY,
			fontSize: "1.2rem",
			fontWeight: 600,
			"&:hover": {
				textDecoration: "underline",
				color: COLORS.accent,
			},
		},
		error: {
			fontFamily: FONT_FAMILY,
			fontWeight: 600,
			color: COLORS.error,
		},
		tableHeader: {
			fontFamily: FONT_FAMILY,
			fontWeight: 500,
			fontSize: "1.15rem",
			lineHeight: 1.15,
			color: COLORS["off-white"],
			letterSpacing: "0.0075em",
		},
		tableCell: {
			fontFamily: FONT_FAMILY,
			fontWeight: 400,
			fontSize: "0.875rem",
			letterSpacing: "1.15px",
			color: COLORS["off-white"],
		},
		blockHeader: {
			fontFamily: FONT_FAMILY,
			margin: 0,
			fontWeight: 400,
			fontSize: "1.5rem",
			lineHeight: 1.33,
			letterSpacing: 0,
			color: COLORS["off-white"],
		},
		pageHeader: {
			fontFamily: FONT_FAMILY,
			fontWeight: 400,
			fontSize: "1.75rem",
			color: COLORS["nav-bg"],
		},
		h1: { fontFamily: FONT_FAMILY },
		h2: { fontFamily: FONT_FAMILY },
		h3: { fontFamily: FONT_FAMILY },
		h4: { fontFamily: FONT_FAMILY },
		h5: { fontFamily: FONT_FAMILY },
		h6: { fontFamily: FONT_FAMILY },
		subtitle1: { fontFamily: FONT_FAMILY },
		subtitle2: { fontFamily: FONT_FAMILY },
		body1: { fontFamily: FONT_FAMILY },
		body2: { fontFamily: FONT_FAMILY },
	},
	components: {
		MuiButton: {
			styleOverrides: {
				root: {
					transition: "all 0.7s ease-in",
					"&.Mui-disabled": {
						color: "var(--disabled)",
						border: "1px solid var(--disabled)",
					},
				},
			},
			variants: [
				{ props: { variant: "contained" }, style: { color: "var(--nav-bg)", border: "1px solid var(--accent)" } },
				{ props: { variant: "outlined" }, style: { color: "var(--accent)", border: "1px solid var(--accent)" } },
			],
		},
		MuiContainer: {
			styleOverrides: {
				root: {
					width: "100%",
					maxWidth: "100%",
					height: "100%",
					maxHeight: "100",
					paddingInline: 0,
				},
			},
		},
		MuiAppBar: {
			styleOverrides: {
				root: {
					background: COLORS.bg,
					position: "sticky",
					height: "4rem",
					width: "100%",
					maxWidth: "100%",
					paddingInline: "10%",
				},
			},
		},
		MuiDivider: {
			styleOverrides: {
				root: {
					borderColor: COLORS["nav-bg"],
					borderWidth: "1.66px",
				},
			},
		},
		MuiTypography: {
			defaultProps: {
				variantMapping: {
					navTitle: "a",
					blockHeader: "h2",
					pageHeader: "h1",
					base: "span",
					baseXl: "span",
				},
			},
		},
		MuiTableContainer: {
			styleOverrides: {
				root: {
					width: "100%",
					maxWidth: "100%",
					maxHeight: "100%",
					overflow: "hidden",
					backgroundColor: COLORS.bg,
					color: COLORS["off-white"],
				},
			},
		},
		MuiTable: {
			styleOverrides: {
				root: {
					backgroundColor: COLORS.bg,
				},
			},
		},
		MuiTableRow: {
			styleOverrides: {
				root: {
					width: "100%",
					cursor: "pointer",
					"&:hover&:not(.MuiTableRow-head) *": {
						color: `${COLORS.accent} !important`,
					},
				},
			},
		},
		MuiTableCell: {
			styleOverrides: {
				root: {
					color: COLORS["off-white"],
					letterSpacing: 1.15,
					alignItems: "center",
					display: "table-cell",
					textAlign: "center",
					"&.MuiTableCell-head": { fontWeight: 600, fontSize: "1.1rem" },
				},
			},
		},
		MuiPagination: {
			styleOverrides: {
				root: {
					backgroundColor: COLORS.bg,
					justifyItems: "self-end",
				},
			},
		},
		MuiPaginationItem: {
			styleOverrides: {
				root: {
					color: COLORS["off-white"],
					"&.Mui-selected": {
						backgroundColor: COLORS.accent,
						color: COLORS["off-white"],
						pointerEvents: "none",
					},
					"&.Mui-disabled": {
						opacity: 1,
						color: COLORS["disabled"],
					},
				},
			},
		},
	},
};

export default theme;

