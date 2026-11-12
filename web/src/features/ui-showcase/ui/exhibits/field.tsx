import {
	Button,
	Checkbox,
	Field,
	FieldSet,
	FieldSummary,
	focusField,
	Input,
	Label,
	useFieldCheck,
} from "@violet/ui";
import { type FormEvent, useId, useState } from "react";
import type { Exhibit, ExhibitRenderProps } from "../../model/exhibit";

const TAKEN_NAMES = ["admin", "rua", "root"];

/** 模拟服务端查重：500ms 后给结果，被中止时抛出，与真实请求一致。 */
function lookupUsername(name: string, signal: AbortSignal) {
	return new Promise<string | undefined>((resolve, reject) => {
		const timer = setTimeout(
			() => resolve(TAKEN_NAMES.includes(name) ? "已被占用，换一个试试" : undefined),
			500,
		);
		signal.addEventListener(
			"abort",
			() => {
				clearTimeout(timer);
				reject(new DOMException("aborted", "AbortError"));
			},
			{ once: true },
		);
	});
}

const checkEmail = (value: string) =>
	value === "" || /^\S+@\S+\.\S+$/.test(value) ? undefined : "邮箱格式不正确，缺少 @ 或域名";

const checkUsername = (value: string) =>
	value !== "" && value.length < 3 ? "至少 3 个字符" : undefined;

const checkSiteUrl = (value: string) =>
	/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(value) ? undefined : "地址里要有域名，例如 xunrua.top";

const checkTitle = (value: string) => (value.trim() === "" ? "请填写标题" : undefined);

const checkSource = (value: string) =>
	value !== "" && !/^https?:\/\//.test(value) ? "链接要以 http:// 或 https:// 开头" : undefined;

const BIO_MAX = 40;

function VerticalFields() {
	const [email, setEmail] = useState("");
	const [username, setUsername] = useState("");
	const [bio, setBio] = useState("写代码的人，也写字。");
	const emailCheck = useFieldCheck({ value: email, validate: checkEmail });
	const usernameCheck = useFieldCheck({
		value: username,
		validate: checkUsername,
		validateAsync: lookupUsername,
		revealOn: "change",
	});
	return (
		<div className="flex w-full max-w-120 flex-col gap-5">
			<Field label="邮箱" hint="只用于回复通知，不会公开" error={emailCheck.error}>
				<Input
					type="email"
					inputMode="email"
					autoComplete="email"
					placeholder="name@example.com"
					value={email}
					onChange={(event) => setEmail(event.target.value)}
					{...emailCheck.fieldProps}
				/>
			</Field>
			<Field
				label="用户名"
				hint="主页地址会用到它"
				error={usernameCheck.error}
				checking={usernameCheck.checking ? "正在检查…" : undefined}
				success={usernameCheck.valid ? "可以使用" : undefined}
			>
				<Input
					autoComplete="username"
					placeholder="至少 3 个字符"
					maxLength={20}
					leading="@"
					loading={usernameCheck.checking}
					valid={usernameCheck.valid}
					value={username}
					onChange={(event) => setUsername(event.target.value)}
					{...usernameCheck.fieldProps}
				/>
			</Field>
			<Field
				label="简介"
				optional
				hint="显示在个人主页名字下面"
				count={{ value: bio.length, max: BIO_MAX }}
			>
				<Input
					placeholder="写代码的人，也写字。"
					maxLength={BIO_MAX}
					value={bio}
					onChange={(event) => setBio(event.target.value)}
				/>
			</Field>
		</div>
	);
}

function HorizontalFields() {
	const [siteName, setSiteName] = useState("Violet");
	const [siteUrl, setSiteUrl] = useState("xunrua.top");
	const urlCheck = useFieldCheck({ value: siteUrl, validate: checkSiteUrl });
	return (
		<div className="flex w-full flex-col gap-5">
			<Field label="站点名称" orientation="horizontal" hint="出现在浏览器标签与 RSS 里">
				<Input value={siteName} onChange={(event) => setSiteName(event.target.value)} />
			</Field>
			<Field
				label="站点地址"
				orientation="horizontal"
				hint="改了以后，旧地址会自动跳转"
				error={urlCheck.error}
			>
				<Input
					inputMode="url"
					autoComplete="url"
					leading="https://"
					value={siteUrl}
					onChange={(event) => setSiteUrl(event.target.value)}
					{...urlCheck.fieldProps}
				/>
			</Field>
		</div>
	);
}

const CHANNELS = [
	{ id: "mail", label: "邮件" },
	{ id: "site", label: "站内通知" },
	{ id: "rss", label: "RSS" },
];

function GroupFields() {
	const id = useId();
	const [selected, setSelected] = useState(["mail", "site"]);
	const check = useFieldCheck({
		value: selected,
		validate: (value) => (value.length === 0 ? "至少选一种通知方式" : undefined),
		revealOn: "change",
	});
	const toggle = (channel: string, on: boolean) =>
		setSelected((current) =>
			on ? [...current, channel] : current.filter((item) => item !== channel),
		);
	return (
		<FieldSet
			className="w-full max-w-105"
			legend="通知方式"
			description="至少选一种，有人回复你时用它通知"
			hint={`已选 ${selected.length} 种`}
			error={check.error}
		>
			<div className="flex gap-6">
				{CHANNELS.map((channel) => (
					<span key={channel.id} className="flex items-center gap-2">
						<Checkbox
							id={`${id}-${channel.id}`}
							checked={selected.includes(channel.id)}
							onCheckedChange={(on) => toggle(channel.id, on === true)}
						/>
						<Label htmlFor={`${id}-${channel.id}`}>{channel.label}</Label>
					</span>
				))}
			</div>
		</FieldSet>
	);
}

function SubmitForm() {
	const id = useId();
	const titleId = `${id}-title`;
	const sourceId = `${id}-source`;
	const [title, setTitle] = useState("");
	const [source, setSource] = useState("");
	const titleCheck = useFieldCheck({ value: title, validate: checkTitle });
	const sourceCheck = useFieldCheck({ value: source, validate: checkSource });
	const errors = [
		titleCheck.error ? { id: titleId, label: "标题" } : null,
		sourceCheck.error ? { id: sourceId, label: "转载来源" } : null,
	].filter((item) => item !== null);

	const submit = (event: FormEvent) => {
		event.preventDefault();
		titleCheck.touch();
		sourceCheck.touch();
		const first = [
			{ id: titleId, error: checkTitle(title) },
			{ id: sourceId, error: checkSource(source) },
		].find((item) => item.error);
		if (first) setTimeout(() => focusField(first.id), 0);
	};
	const clear = () => {
		setTitle("");
		setSource("");
		titleCheck.reset();
		sourceCheck.reset();
	};

	return (
		<form noValidate onSubmit={submit} className="flex w-full max-w-120 flex-col gap-5">
			<FieldSummary errors={errors} />
			<Field label="标题" hint="会出现在列表与分享卡片上" error={titleCheck.error}>
				<Input
					id={titleId}
					placeholder="文章标题"
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					{...titleCheck.fieldProps}
				/>
			</Field>
			<Field label="转载来源" optional hint="转载时填原文地址" error={sourceCheck.error}>
				<Input
					id={sourceId}
					type="url"
					inputMode="url"
					autoComplete="off"
					placeholder="https://"
					value={source}
					onChange={(event) => setSource(event.target.value)}
					{...sourceCheck.fieldProps}
				/>
			</Field>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={clear}>
					清空
				</Button>
				<Button type="submit" variant="primary">
					发布
				</Button>
			</div>
		</form>
	);
}

function FieldFamily({ state }: ExhibitRenderProps) {
	if (state === "horizontal") return <HorizontalFields />;
	if (state === "group") return <GroupFields />;
	if (state === "submit") return <SubmitForm />;
	return <VerticalFields />;
}

export const fieldExhibit: Exhibit = {
	id: "field",
	name: "表单项",
	units: ["field"],
	zone: "field",
	category: "form",
	footprint: { width: 640, height: 440 },
	states: [
		{ id: "vertical", label: "纵向" },
		{ id: "horizontal", label: "横排" },
		{ id: "group", label: "一组" },
		{ id: "submit", label: "提交时" },
	],
	Render: FieldFamily,
};
