import type { Geometry, Palette, Scene, SceneItem } from "@violet/sketch";
import {
	circleGeometry,
	geometryFromCommands,
	geometryFromPath,
	polyline,
	rectangleGeometry,
} from "@violet/sketch";

/** 原创画室插画的场景色板；笔迹与填充算法只引用这些角色。 */
export const comicPalette: Palette = {
	ink: "#302b43",
	shadow: "#514164",
	highlight: "#fff6dd",
	wall: "#f7e5cb",
	wallShade: "#e9cda9",
	floor: "#d8b28e",
	sky: "#b9dded",
	cloud: "#fff6df",
	distant: "#91b5c8",
	window: "#fff0d2",
	wood: "#c18b64",
	woodLight: "#e2b586",
	woodDark: "#976954",
	paper: "#fff8e7",
	paperShade: "#e8dbc8",
	hair: "#4a405e",
	hairLight: "#786582",
	skin: "#f5c6a7",
	skinShade: "#e5a98e",
	blush: "#e99393",
	eyeWhite: "#fff9eb",
	iris: "#57776c",
	pupil: "#302d43",
	shirt: "#719eaf",
	shirtShade: "#507c95",
	collar: "#f5eccf",
	coral: "#dc7b72",
	gold: "#e8b968",
	leaf: "#759b75",
	leafDark: "#497967",
	leafLight: "#a4b87c",
	pot: "#c87d62",
	potShade: "#a65d50",
	lilac: "#afa0c5",
	teal: "#5f9394",
};

const items: SceneItem[] = [];

function shape(id: string, geometry: Geometry, fillRole?: string, strokeRole = "ink") {
	items.push({ id, geometry, fillRole, strokeRole });
}

function path(id: string, d: string, fillRole?: string, strokeRole = "ink") {
	shape(id, geometryFromPath(d), fillRole, strokeRole);
}

function rect(
	id: string,
	x: number,
	y: number,
	w: number,
	h: number,
	role: string,
	radius = 0,
	strokeRole = "ink",
) {
	shape(id, rectangleGeometry(x, y, w, h, radius), role, strokeRole);
}

function ellipse(
	id: string,
	x: number,
	y: number,
	rx: number,
	ry: number,
	fillRole: string,
	strokeRole = "ink",
) {
	shape(
		id,
		geometryFromCommands([
			{ op: "M", values: [x - rx, y] },
			{ op: "A", values: [rx, ry, 0, 1, 0, x + rx, y] },
			{ op: "A", values: [rx, ry, 0, 1, 0, x - rx, y] },
			{ op: "Z", values: [] },
		]),
		fillRole,
		strokeRole,
	);
}

function line(id: string, points: readonly [number, number][], strokeRole = "ink") {
	shape(id, polyline(points.map(([x, y]) => ({ x, y }))), undefined, strokeRole);
}

// Room, window light and distant rooflines.
rect("room-wall", 12, 12, 936, 696, "wall", 24, "wall");
path("floor", "M12 588L948 588L948 684Q948 708 924 708L36 708Q12 708 12 684Z", "floor", "floor");
path("window-cast-light", "M112 409L347 409L770 708L404 708Z", "wallShade", "wallShade");
path("window-arch", "M66 437L66 202C66 31 374 31 374 202L374 437Z", "window");
path("window-sky", "M82 420L82 202C82 55 358 55 358 202L358 420Z", "sky");
path(
	"cloud-one",
	"M121 169C115 157 129 149 141 153C139 129 174 125 182 146C207 136 220 160 210 169Z",
	"cloud",
	"cloud",
);
path(
	"cloud-two",
	"M252 220C244 206 257 195 270 201C278 178 305 186 304 201C321 194 337 208 329 220Z",
	"cloud",
	"cloud",
);
path(
	"outside-roofs",
	"M82 359L113 337L142 356L142 318L179 292L214 318L214 366L259 343L297 363L323 326L358 348L358 420L82 420Z",
	"distant",
	"distant",
);
line(
	"distant-window-a",
	[
		[164, 336],
		[174, 336],
		[174, 349],
		[164, 349],
		[164, 336],
	],
	"sky",
);
line(
	"distant-window-b",
	[
		[190, 336],
		[200, 336],
		[200, 349],
		[190, 349],
		[190, 336],
	],
	"sky",
);
rect("window-middle-post", 211, 80, 16, 340, "window");
rect("window-crossbar", 82, 255, 276, 14, "window");
rect("window-sill", 49, 427, 343, 20, "woodLight", 5);
line(
	"window-sill-grain",
	[
		[63, 441],
		[377, 441],
	],
	"wood",
);
path("curtain-left", "M36 97Q67 79 93 99L94 421Q69 402 36 426Q52 267 36 97Z", "paper");
path("curtain-fold-one", "M53 113Q68 224 54 397", undefined, "paperShade");
path("curtain-fold-two", "M75 112Q85 258 73 403", undefined, "paperShade");
line(
	"curtain-rod",
	[
		[27, 86],
		[403, 86],
	],
	"woodDark",
);

// Shelf and the small still life above the working desk.
rect("shelf-bracket-left", 714, 177, 11, 39, "woodDark", 2);
rect("shelf-bracket-right", 880, 177, 11, 39, "woodDark", 2);
rect("wall-shelf", 701, 170, 207, 15, "woodLight", 3);
rect("shelf-book-lilac", 721, 95, 25, 75, "lilac", 3);
rect("shelf-book-coral", 749, 111, 20, 59, "coral", 2);
path("shelf-book-teal", "M783 106L802 102L817 167L797 171Z", "teal");
line(
	"shelf-book-spines",
	[
		[728, 105],
		[739, 105],
	],
	"paper",
);
line(
	"shelf-book-spine-two",
	[
		[753, 121],
		[763, 121],
	],
	"paper",
);
ellipse("shelf-vase-body", 861, 145, 21, 24, "pot");
path("shelf-vase-neck", "M850 126L848 112L872 112L870 126Z", "pot");
path("shelf-flower-stem", "M860 113Q851 87 858 67M861 103Q882 89 884 72", undefined, "leafDark");
path("shelf-flower-leaf", "M858 96Q837 96 840 83Q854 83 858 96Z", "leaf");
for (const [i, x, y] of [
	[0, 855, 64],
	[1, 866, 61],
	[2, 863, 73],
	[3, 879, 66],
	[4, 889, 70],
] as const) {
	shape(
		`flower-petal-${i}`,
		circleGeometry(x, y, 7),
		i < 3 ? "coral" : "lilac",
		i < 3 ? "coral" : "lilac",
	);
}
shape("flower-centre", circleGeometry(861, 67, 4), "gold", "gold");
rect("pinned-note", 740, 242, 106, 78, "paper", 3);
shape("note-pin", circleGeometry(793, 249, 4), "coral");
path(
	"note-botanical-doodle",
	"M785 306Q804 281 792 263M794 289Q775 288 775 276Q788 275 794 289M796 281Q811 280 813 268Q800 266 796 281",
	undefined,
	"leafDark",
);
line(
	"note-caption",
	[
		[757, 309],
		[776, 309],
	],
	"woodDark",
);

// The leafy plant remains a reusable arrangement of closed leaf paths.
path(
	"plant-stems",
	"M837 527Q819 449 824 361M837 517Q870 438 875 384M833 500Q790 446 772 414M842 498Q893 482 910 447",
	undefined,
	"leafDark",
);
path("plant-leaf-upper-left", "M824 393C791 390 782 360 803 338C826 343 833 370 824 393Z", "leaf");
path(
	"plant-leaf-upper-right",
	"M828 418C823 383 850 357 877 365C881 392 859 413 828 418Z",
	"leafLight",
);
path(
	"plant-leaf-middle-left",
	"M820 456C786 453 766 437 770 406C800 402 823 427 820 456Z",
	"leafDark",
);
path(
	"plant-leaf-middle-right",
	"M858 452C856 420 882 397 909 407C910 433 890 448 858 452Z",
	"leaf",
);
path(
	"plant-leaf-low-left",
	"M833 495C800 506 773 482 776 458C803 449 829 470 833 495Z",
	"leafLight",
);
path(
	"plant-leaf-low-right",
	"M854 496C878 466 913 461 927 479C913 506 881 514 854 496Z",
	"leafDark",
);
path(
	"plant-leaf-veins",
	"M804 350L824 393M865 377L828 418M783 418L820 456M895 418L858 452M787 469L833 495M914 483L854 496",
	undefined,
	"leafDark",
);
ellipse("plant-pot-rim", 838, 526, 44, 12, "potShade");
path("plant-pot", "M794 526L804 587Q837 607 871 587L882 526Q837 545 794 526Z", "pot");
path("plant-pot-stripe", "M801 548Q837 563 875 548", undefined, "woodLight");

// Chair, hair silhouette and the seated illustrator.
path("chair-back", "M457 428Q449 381 475 372L639 372Q665 382 658 428L646 579L470 579Z", "wood");
path(
	"chair-inset",
	"M474 410Q474 391 493 391L623 391Q642 392 641 410L630 552L486 552Z",
	"woodLight",
);
path(
	"ponytail",
	"M599 238C648 227 657 271 647 302C646 331 683 334 679 369C665 401 615 389 613 355C610 326 589 310 599 238Z",
	"hair",
);
path(
	"ponytail-shine",
	"M630 265C641 297 624 319 650 348Q665 362 653 375C630 361 615 336 623 311Z",
	"hairLight",
	"hairLight",
);
path(
	"hair-back",
	"M482 313C466 284 470 240 482 214C499 178 549 174 583 191C618 200 632 242 618 281L616 340Q587 367 550 353Q513 360 482 313Z",
	"hair",
);
path(
	"shirt-body",
	"M506 382Q527 369 542 371L576 371Q593 371 612 381Q641 390 643 418L654 541L465 541L478 416Q481 393 506 382Z",
	"shirt",
);
path(
	"shirt-right-shade",
	"M594 386Q626 402 623 435L625 533L652 539L642 417Q640 393 614 382Z",
	"shirtShade",
	"shirtShade",
);
path("shirt-left-sleeve", "M484 394Q462 406 461 448L505 463L524 410Z", "shirt");
path("shirt-right-sleeve", "M601 393Q633 390 648 425L662 460L617 477L592 426Z", "shirt");
path(
	"sleeve-folds",
	"M472 441L502 451M624 457L651 447M501 485Q510 500 507 517M599 483Q589 500 600 520",
	undefined,
	"shirtShade",
);
path(
	"neck",
	"M536 330L537 368Q526 380 517 384Q532 407 557 414Q584 405 596 384Q581 379 578 366L581 330Z",
	"skin",
);
path("neck-shadow", "M536 332L580 332L577 353Q558 368 537 355Z", "skinShade", "skinShade");
path("collar-left", "M517 377L557 411L534 431L510 393Z", "collar");
path("collar-right", "M592 377L557 411L579 431L603 394Z", "collar");
shape("shirt-button-one", circleGeometry(557, 438, 3), "collar");
shape("shirt-button-two", circleGeometry(557, 468, 3), "collar");
line(
	"shirt-placket",
	[
		[557, 447],
		[557, 508],
	],
	"shirtShade",
);
ellipse("ear-left", 491, 286, 12, 19, "skin");
ellipse("ear-right", 608, 282, 11, 19, "skin");
path("ear-details", "M489 279Q500 277 496 292M606 274Q614 279 605 289", undefined, "skinShade");
path(
	"face",
	"M495 242C506 212 576 201 599 234C610 256 610 287 598 317Q582 345 559 350Q534 350 512 325C499 307 491 269 495 242Z",
	"skin",
);
path(
	"face-shade",
	"M597 254Q607 285 591 311Q578 333 559 344Q586 344 599 320Q613 288 605 259Z",
	"skinShade",
	"skinShade",
);
path(
	"fringe",
	"M487 260C480 218 517 186 555 191C590 190 621 220 611 256Q595 253 582 235Q585 252 572 264Q554 253 540 229Q536 249 520 261L517 242Q505 259 487 260Z",
	"hair",
);
path(
	"fringe-shine",
	"M503 221Q521 198 553 203Q535 211 526 228Q517 236 508 238Z",
	"hairLight",
	"hairLight",
);
path("hair-side-left", "M489 249Q504 249 504 274L505 316L490 306Q480 278 489 249Z", "hair");
path(
	"hair-side-right",
	"M601 245Q613 244 615 261Q616 280 606 302L600 307Q607 270 601 245Z",
	"hair",
);
path("hair-clip", "M486 230L508 218L514 226L491 239Z", "coral");
line(
	"clip-detail",
	[
		[491, 231],
		[505, 223],
	],
	"gold",
);
path("eyebrow-left", "M519 269Q535 260 548 268", undefined, "hair");
path("eyebrow-right", "M571 267Q584 259 595 267", undefined, "hair");
path("eye-left", "M519 284Q534 270 550 282Q540 296 523 291Z", "eyeWhite");
path("eye-right", "M570 282Q583 269 598 280Q589 293 574 290Z", "eyeWhite");
ellipse("iris-left", 537, 283, 6, 8, "iris");
ellipse("iris-right", 585, 281, 6, 8, "iris");
ellipse("pupil-left", 538, 284, 2.5, 5.5, "pupil", "pupil");
ellipse("pupil-right", 586, 282, 2.5, 5.5, "pupil", "pupil");
shape("eye-glint-left", circleGeometry(535, 280, 2), "highlight", "highlight");
shape("eye-glint-right", circleGeometry(583, 278, 2), "highlight", "highlight");
path(
	"upper-lashes",
	"M517 281L522 282Q535 271 550 282M569 281Q583 269 597 280L600 276",
	undefined,
	"hair",
);
ellipse("cheek-left", 519, 306, 11, 5, "blush", "blush");
ellipse("cheek-right", 592, 302, 10, 5, "blush", "blush");
path("nose", "M562 285L557 302Q562 306 566 302", undefined, "skinShade");
path("smile", "M545 320Q558 330 573 318", undefined, "ink");
path("lower-lip", "M552 331Q561 334 568 329", undefined, "blush");
shape("earring", circleGeometry(491, 304, 4), "gold");

// Desk and sketchbook in the foreground.
path("desk-left-leg", "M111 590L135 590L149 708L123 708Z", "woodDark");
path("desk-right-leg", "M775 590L800 590L788 708L762 708Z", "woodDark");
path("desk-front", "M66 574L840 574L840 618L66 618Z", "wood");
path("desk-top", "M123 512L784 512L866 575L54 575Z", "woodLight");
line(
	"desk-grain-one",
	[
		[94, 587],
		[820, 587],
	],
	"woodDark",
);
line(
	"desk-grain-two",
	[
		[295, 605],
		[711, 605],
	],
	"woodDark",
);
path("book-bottom", "M153 544L284 544L305 564L167 564Z", "teal");
path("book-bottom-pages", "M167 552L303 552L305 564L167 564Z", "paperShade");
path("book-middle", "M142 526L266 526L286 546L155 546Z", "coral");
path("book-middle-pages", "M155 535L282 535L286 546L155 546Z", "paper");
path("book-top", "M166 508L268 508L283 525L176 525Z", "lilac");
line(
	"book-page-edges",
	[
		[175, 557],
		[295, 557],
	],
	"wood",
);
path("pencil-cup", "M316 470L362 470L357 530Q337 540 321 530Z", "teal");
ellipse("pencil-cup-rim", 339, 470, 23, 7, "shirtShade");
path("cup-brush-one", "M328 469L320 416L325 415L334 469Z", "wood");
path("brush-tip-one", "M320 419Q306 403 315 394Q328 395 325 418Z", "hair");
path("cup-brush-two", "M343 469L353 417L358 418L349 470Z", "gold");
path("brush-tip-two", "M353 419Q347 397 359 394Q371 402 358 423Z", "coral");
path("cup-pencil", "M337 470L336 423L341 423L342 469Z", "lilac");
path("paint-tube", "M701 543L757 531L764 548L710 560Z", "paper");
path("paint-tube-band", "M722 539L744 535L751 551L730 556Z", "coral");
path("paint-tube-cap", "M699 542L707 540L713 558L704 561Z", "woodDark");
path("sketchbook-cover", "M415 536L541 543L651 530L674 632L535 652L392 627Z", "coral");
path("sketchbook-left-page", "M421 529L540 538L535 642L400 618Z", "paper");
path("sketchbook-right-page", "M540 538L646 524L664 622L535 642Z", "paper");
path("sketchbook-gutter", "M540 538Q533 587 535 642", undefined, "paperShade");
path(
	"page-botanical-stem",
	"M453 607Q462 575 493 554M465 587Q457 569 449 563M476 573L503 577",
	undefined,
	"leafDark",
);
path("page-leaf-one", "M463 589Q437 584 439 568Q459 566 463 589Z", "leaf");
path("page-leaf-two", "M477 575Q478 555 495 551Q503 566 477 575Z", "leafLight");
path("page-leaf-three", "M477 575Q499 570 506 583Q491 594 477 575Z", "leaf");
path(
	"page-study-flower",
	"M581 583Q571 568 582 559Q594 555 597 570Q610 560 617 573Q619 586 600 587Q613 599 600 606Q585 610 587 593Q571 603 568 591Q568 580 581 583Z",
	undefined,
	"woodDark",
);
line(
	"page-study-stem",
	[
		[593, 585],
		[607, 614],
	],
	"leafDark",
);
items.push({
	id: "sketchbook-label",
	geometry: polyline([]),
	strokeRole: "woodDark",
	label: { text: "Étude du matin", x: 426, y: 620, size: 10 },
});

// Hands and pencil are above the pages so the drawing gesture remains readable.
path(
	"left-forearm",
	"M469 451L500 461Q493 481 496 505L525 526L509 547Q474 540 466 513Q459 483 469 451Z",
	"skin",
);
path(
	"left-hand",
	"M496 516Q506 514 517 521L539 531Q548 535 545 540Q540 544 530 539L518 536Q536 543 529 548Q521 551 509 544Q507 555 498 549L484 536Z",
	"skin",
);
path("left-finger-lines", "M508 526L529 536M504 533L521 543", undefined, "skinShade");
path("right-forearm", "M627 468L652 457Q674 490 659 513L623 542L602 525L630 497Z", "skin");
path(
	"right-hand",
	"M613 516Q601 512 592 520L580 536Q576 542 582 547Q590 551 597 540L604 536Q598 551 606 554Q614 555 622 541L633 531Z",
	"skin",
);
path("right-finger-lines", "M592 526L606 535M602 521L615 531", undefined, "skinShade");
path("drawing-pencil", "M585 557L618 500L624 504L591 561Z", "gold");
path("pencil-graphite", "M585 557L582 567L591 561Z", "pupil");
path("pencil-eraser", "M618 500L623 490L629 494L624 504Z", "coral");
line(
	"pencil-shine",
	[
		[592, 552],
		[618, 507],
	],
	"highlight",
);

// Small tabletop colour swatches complete the artist's working environment.
ellipse("palette-board", 746, 585, 49, 25, "paperShade");
for (const [i, x, y, role] of [
	[0, 718, 581, "coral"],
	[1, 739, 575, "gold"],
	[2, 761, 577, "leaf"],
	[3, 776, 590, "shirt"],
	[4, 747, 597, "lilac"],
] as const)
	ellipse(`palette-dab-${i}`, x, y, 8, 5, role, role);
ellipse("palette-thumb-hole", 715, 595, 7, 5, "woodLight");
path("table-rag", "M297 565L349 556L369 588L309 598Q322 581 297 565Z", "collar");
path("rag-folds", "M320 565L340 585M343 568L352 583", undefined, "paperShade");

/** 同一组纯矢量几何可切换任意 Pen，对照画室角色、衣着、环境与彩色层次。 */
export const comicScene: Scene = { width: 960, height: 720, items };
