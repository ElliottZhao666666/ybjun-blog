import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { LinkPreset, type NavbarLink } from "@/types/config";

export const LinkPresets: { [key in LinkPreset]: NavbarLink } = {
	[LinkPreset.Home]: {
		name: "首页",
		url: "/",
		icon: "material-symbols:home",
		description: "Twilight - A simple, clean, and beautiful blog theme.",
	},
	[LinkPreset.Archive]: {
		name: "文章",
		url: "/archive/",
		icon: "material-symbols:archive",
		description: "A chronological list of all published posts.",
	},
	[LinkPreset.Projects]: {
		name: i18n(I18nKey.projects),
		url: "/projects/",
		icon: "material-symbols:work",
		description: i18n(I18nKey.projectsSubtitle),
	},
	[LinkPreset.Diary]: {
		name: i18n(I18nKey.diary),
		url: "/diary/",
		icon: "material-symbols:book",
		description: i18n(I18nKey.diarySubtitle),
	},
	[LinkPreset.Friends]: {
		name: i18n(I18nKey.friends),
		url: "/friends/",
		icon: "material-symbols:group",
		description: "A curated list of friend sites.",
	},
	[LinkPreset.About]: {
		name: "关于",
		url: "/about/",
		icon: "material-symbols:info",
		description: i18n(I18nKey.about),
	},
};
