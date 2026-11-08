/** 友链申请中由访客填写的名片与联系信息。 */
export interface FriendLinkForm {
	name: string;
	url: string;
	avatar_url: string;
	description: string;
	owner_name: string;
	linkback_url: string;
	contact_email: string;
}

export const EMPTY_FORM: FriendLinkForm = {
	name: "",
	url: "",
	avatar_url: "",
	description: "",
	owner_name: "",
	linkback_url: "",
	contact_email: "",
};
