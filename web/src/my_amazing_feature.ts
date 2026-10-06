import $ from "jquery";

import {realm} from "./state_data.ts";

export function update_message_text_color(): void {
    $("body").toggleClass("my-amazing-feature", realm.realm_my_amazing_feature);
}
