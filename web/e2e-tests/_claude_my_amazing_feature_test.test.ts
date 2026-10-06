import type {Page} from "puppeteer";

import * as common from "./lib/common.ts";

const results: string[] = [];
function check(name: string, ok: boolean): void {
    results.push(`${ok ? "PASS" : "FAIL"}: ${name}`);
    console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
}

async function message_color(page: Page): Promise<string> {
    return await page.evaluate(() => {
        const el = document.querySelector(".message_row .message_content:not(.status-message)");
        return el ? getComputedStyle(el).color : "none";
    });
}

async function visual_test(page: Page): Promise<void> {
    await common.log_in(page);
    await page.goto("http://zulip.zulipdev.com:9981/#feed");
    await page.waitForSelector(".message_row .message_content", {visible: true});
    const before = await message_color(page);
    console.log(`color before: ${before}`);
    await common.screenshot(page, "step-1-feature-off");

    await common.manage_organization(page);
    await page.click("li[data-section='organization-settings']");
    await page.waitForSelector("#id_realm_my_amazing_feature", {visible: true});
    await common.screenshot(page, "step-2-settings-checkbox");
    await page.click("label[for='id_realm_my_amazing_feature'], #id_realm_my_amazing_feature");
    await page.waitForSelector('#org-msg-feed-settings .save-button[data-status="unsaved"]', {
        visible: true,
    });
    await page.click("#org-msg-feed-settings .save-button");
    await page.waitForSelector('#org-msg-feed-settings .save-button[data-status="saved"]', {
        visible: true,
    });

    // Live event updates the body class without a reload.
    await page.waitForFunction(() => document.body.classList.contains("my-amazing-feature"));
    check("body class added by live event", true);

    await page.keyboard.press("Escape");
    await page.waitForSelector("#settings_overlay_container", {hidden: true});
    const after = await message_color(page);
    console.log(`color after: ${after}`);
    check("message color changed", after !== before);
    check("message color is purple (#522ab4)", after === "rgb(82, 42, 180)");
    await common.screenshot(page, "step-3-feature-on-light");

    // Survives reload (initial state path).
    await page.reload({waitUntil: "networkidle2"});
    await page.goto("http://zulip.zulipdev.com:9981/#feed");
    await page.waitForSelector(".message_row .message_content", {visible: true});
    check("purple after reload", (await message_color(page)) === "rgb(82, 42, 180)");

    // Dark theme.
    await page.evaluate(async () => {
        const csrfToken =
            document.querySelector<HTMLInputElement>('input[name="csrfmiddlewaretoken"]')?.value ??
            "";
        await fetch("/json/settings", {
            method: "PATCH",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "X-CSRFToken": csrfToken,
            },
            body: "color_scheme=2",
        });
    });
    await page.reload({waitUntil: "networkidle2"});
    await page.goto("http://zulip.zulipdev.com:9981/#feed");
    await page.waitForSelector(".message_row .message_content", {visible: true});
    const dark = await message_color(page);
    console.log(`color dark: ${dark}`);
    check("dark theme uses lighter purple (#aba5fd)", dark === "rgb(171, 165, 253)");
    await common.screenshot(page, "step-4-feature-on-dark");

    const failures = results.filter((r) => r.startsWith("FAIL"));
    console.log(`\n${results.length - failures.length}/${results.length} tests passed`);
}

await common.run_test(visual_test);
