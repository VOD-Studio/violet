import type { Exhibit } from "../../model/exhibit";
import { avatarExhibit } from "./avatar";
import { badgeExhibit } from "./badge";
import { buttonExhibit } from "./button";
import { cardExhibit } from "./card";
import { cascaderExhibit } from "./cascader";
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
import { imagePixelRevealExhibit } from "./image-pixel-reveal";
import { indicatorExhibit } from "./indicator";
import { inputExhibit } from "./input";
import { kbdExhibit } from "./kbd";
import { linkCardExhibit } from "./link-card";
import { morphingPopoverExhibit } from "./morphing-popover";
import { navbarExhibit } from "./navbar";
import { numberInputExhibit } from "./number-input";
import { otpExhibit } from "./otp";
import { popoverExhibit } from "./popover";
import { presenceExhibit } from "./presence";
import { radioExhibit } from "./radio";
import { segmentedExhibit } from "./segmented";
import { selectExhibit } from "./select";
import { separatorExhibit } from "./separator";
import { sheetExhibit } from "./sheet";
import { sliderExhibit } from "./slider";
import { sonnerExhibit } from "./sonner";
import { switchExhibit } from "./switch";
import { tabsExhibit } from "./tabs";
import { tagInputExhibit } from "./tag-input";
import { textareaExhibit } from "./textarea";
import { toggleGroupExhibit } from "./toggle-group";
import { tooltipExhibit } from "./tooltip";
import { treeSelectExhibit } from "./tree-select";
import { uploadExhibit } from "./upload";
import { uploadTileExhibit } from "./upload-tile";

/** 馆藏目录：顺序即铭牌编号，待建展品随对应工单落地后换成真实组件。 */
export const EXHIBITS: Exhibit[] = [
	navbarExhibit,
	{
		id: "announcement-bar",
		name: "公告浮条",
		units: ["announcement-bar"],
		zone: "banner",
		category: "feedback",
		footprint: { width: 1120, height: 56 },
		issue: 714,
	},
	{
		id: "page-header",
		name: "页头与面包屑",
		units: ["page-header", "breadcrumbs", "steps"],
		zone: "banner",
		category: "navigation",
		footprint: { width: 1120, height: 160 },
		issue: 709,
	},
	{
		id: "table",
		name: "表格",
		units: ["table", "pagination"],
		zone: "banner",
		category: "display",
		footprint: { width: 1120, height: 380 },
		issue: 708,
	},
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
	{
		id: "inbox",
		name: "消息面板",
		units: ["inbox"],
		zone: "stage",
		category: "overlay",
		footprint: { width: 400, height: 520 },
		issue: 715,
	},
	{
		id: "lightbox",
		name: "图片预览",
		units: ["image-preview"],
		zone: "stage",
		category: "overlay",
		footprint: { width: 560, height: 400 },
		issue: 720,
	},
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
	{
		id: "mention",
		name: "提及",
		units: ["mention"],
		zone: "field",
		category: "form",
		footprint: { width: 360, height: 320 },
		issue: 717,
	},
	linkCardExhibit,
	imagePixelRevealExhibit,
	cardExhibit,
	separatorExhibit,
	{
		id: "list",
		name: "列表与树",
		units: ["list", "tree", "accordion"],
		zone: "content",
		category: "display",
		footprint: { width: 400, height: 320 },
		issue: 708,
	},
	{
		id: "alert",
		name: "提示与空状态",
		units: ["progress", "alert", "empty"],
		zone: "content",
		category: "feedback",
		footprint: { width: 520, height: 240 },
		issue: 709,
	},
	{
		id: "chart",
		name: "图表",
		units: ["chart"],
		zone: "content",
		category: "display",
		footprint: { width: 520, height: 280 },
		issue: 709,
	},
	{
		id: "annotation",
		name: "批注",
		units: ["annotation"],
		zone: "content",
		category: "content",
		footprint: { width: 560, height: 240 },
		issue: 716,
	},
	{
		id: "quote-card",
		name: "引用卡",
		units: ["quote-card"],
		zone: "content",
		category: "content",
		footprint: { width: 520, height: 180 },
		issue: 718,
	},
	{
		id: "image-grid",
		name: "图片网格",
		units: ["image-grid"],
		zone: "content",
		category: "content",
		footprint: { width: 480, height: 360 },
		issue: 719,
	},
	{
		id: "code-block",
		name: "代码块",
		units: ["code-block"],
		zone: "content",
		category: "content",
		footprint: { width: 560, height: 320 },
		issue: 720,
	},
	{
		id: "tweet-embed",
		name: "外站推文",
		units: ["react-tweet"],
		zone: "content",
		category: "content",
		footprint: { width: 520, height: 440 },
		issue: 720,
	},
];
