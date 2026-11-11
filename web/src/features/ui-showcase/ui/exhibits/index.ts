import type { Exhibit } from "../../model/exhibit";
import { accordionExhibit } from "./accordion";
import { alertExhibit } from "./alert";
import { announcementBarExhibit } from "./announcement-bar";
import { avatarExhibit } from "./avatar";
import { badgeExhibit } from "./badge";
import { buttonExhibit } from "./button";
import { cardExhibit } from "./card";
import { cascaderExhibit } from "./cascader";
import { chartExhibit } from "./chart";
import { checkboxExhibit } from "./checkbox";
import { colorPickerExhibit } from "./color-picker";
import { comboboxExhibit } from "./combobox";
import { commandExhibit } from "./command";
import { datePickerExhibit } from "./date-picker";
import { dialogExhibit } from "./dialog";
import { drawerExhibit } from "./drawer";
import { dropdownExhibit } from "./dropdown";
import { dropdownMenuExhibit } from "./dropdown-menu";
import { fieldExhibit } from "./field";
import { footerExhibit } from "./footer";
import { iconsExhibit } from "./icons";
import { imageGridExhibit } from "./image-grid";
import { imagePixelRevealExhibit } from "./image-pixel-reveal";
import { inboxExhibit } from "./inbox";
import { indicatorExhibit } from "./indicator";
import { inputExhibit } from "./input";
import { kbdExhibit } from "./kbd";
import { lightboxExhibit } from "./lightbox";
import { linkCardExhibit } from "./link-card";
import { listExhibit } from "./list";
import { mentionExhibit } from "./mention";
import { morphingPopoverExhibit } from "./morphing-popover";
import { navbarExhibit } from "./navbar";
import { numberInputExhibit } from "./number-input";
import { otpExhibit } from "./otp";
import { pageHeaderExhibit } from "./page-header";
import { paginationExhibit } from "./pagination";
import { popoverExhibit } from "./popover";
import { presenceExhibit } from "./presence";
import { quoteCardExhibit } from "./quote-card";
import { radioExhibit } from "./radio";
import { segmentedExhibit } from "./segmented";
import { selectExhibit } from "./select";
import { separatorExhibit } from "./separator";
import { sheetExhibit } from "./sheet";
import { sliderExhibit } from "./slider";
import { sonnerExhibit } from "./sonner";
import { switchExhibit } from "./switch";
import { tableExhibit } from "./table";
import { tabsExhibit } from "./tabs";
import { tagInputExhibit } from "./tag-input";
import { textareaExhibit } from "./textarea";
import { toggleGroupExhibit } from "./toggle-group";
import { tooltipExhibit } from "./tooltip";
import { treeExhibit } from "./tree";
import { treeSelectExhibit } from "./tree-select";
import { tweetEmbedExhibit } from "./tweet-embed";
import { uploadExhibit } from "./upload";
import { uploadTileExhibit } from "./upload-tile";

/** 馆藏目录：顺序即铭牌编号，待建展品随对应工单落地后换成真实组件。 */
export const EXHIBITS: Exhibit[] = [
	navbarExhibit,
	announcementBarExhibit,
	pageHeaderExhibit,
	tableExhibit,
	paginationExhibit,
	footerExhibit,
	dropdownExhibit,
	popoverExhibit,
	tooltipExhibit,
	dropdownMenuExhibit,
	sonnerExhibit,
	dialogExhibit,
	sheetExhibit,
	drawerExhibit,
	commandExhibit,
	morphingPopoverExhibit,
	presenceExhibit,
	inboxExhibit,
	lightboxExhibit,
	buttonExhibit,
	segmentedExhibit,
	checkboxExhibit,
	uploadTileExhibit,
	indicatorExhibit,
	badgeExhibit,
	avatarExhibit,
	kbdExhibit,
	switchExhibit,
	radioExhibit,
	toggleGroupExhibit,
	tabsExhibit,
	inputExhibit,
	fieldExhibit,
	textareaExhibit,
	selectExhibit,
	comboboxExhibit,
	cascaderExhibit,
	treeSelectExhibit,
	tagInputExhibit,
	datePickerExhibit,
	numberInputExhibit,
	sliderExhibit,
	colorPickerExhibit,
	otpExhibit,
	uploadExhibit,
	mentionExhibit,
	linkCardExhibit,
	imagePixelRevealExhibit,
	iconsExhibit,
	cardExhibit,
	separatorExhibit,
	listExhibit,
	treeExhibit,
	accordionExhibit,
	alertExhibit,
	chartExhibit,
	{
		id: "annotation",
		name: "批注",
		units: ["annotation"],
		zone: "content",
		category: "content",
		footprint: { width: 560, height: 240 },
		issue: 716,
	},
	quoteCardExhibit,
	imageGridExhibit,
	{
		id: "code-block",
		name: "代码块",
		units: ["code-block"],
		zone: "content",
		category: "content",
		footprint: { width: 560, height: 320 },
		issue: 720,
	},
	tweetEmbedExhibit,
];
