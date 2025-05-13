/**
 * @name FreeEmojis
 * @version 1.10.0
 * @description Link emojis if you don't have nitro! Type them out or use the emoji picker!
 * @author An0 (Original) & EpicGazel 
 * @source https://github.com/EpicGazel/DiscordFreeEmojis
 * @updateUrl https://raw.githubusercontent.com/EpicGazel/DiscordFreeEmojis/master/DiscordFreeEmojis.plugin.js
 */

/*@cc_on
@if (@_jscript)
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    shell.Popup("It looks like you've mistakenly tried to run me directly. \\n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();
@else @*/


var FreeEmojis = (() => {

    'use strict';
    
    const { createElement, useState } = BdApi.React;
    const { SwitchInput } = BdApi.Components;
        
    const { DOM, Patcher, Logger, Webpack } = BdApi;
    const hideNitroCSSString = `button[class*='emojiItemDisabled'] { 
                filter: none !important; 
                outline: dotted 4px rgba(255, 255, 255, 0.46); 
                outline-offset: -2px; 
                cursor: pointer !important;
            }
    
            /* Makes the dark background transparent */ 
            [class*="emojiLockIconContainer_"] {
            background: rgba(0,0,0,0) !important;
            scale: 0.01 !important;
            }
    
            /* Makes the emoji lock icon itself too small to see */
            [class*="emojiLockIcon_"] {
                width: 0 !important;
            }
    
            /* Hides lock on server icons */
            [class*="categoryItemLockIconContainer_"] {
                display: none;
            }
    
            /* Hides the "Unlock every emoji with Nitro - Get Nitro" pop-up */
            [class*="upsellContainer_"] {
                display: none;
            }
    
            /* Hides the divider between "Frequently Used" and server emojis */
            [class*="categorySectionNitroTopDivider_"] {
                display: none;
            }
    
            /* Makes the pink background behind "locked" emojis transparent. */
            [class*="categorySectionNitroLocked_"] {
                background-color: transparent;
            }
            `;
    const miscellaneousCSS = `/* Other misc rules */
                /* Make (normal) text emojis bigger */
                .emoji.jumboable {
                    width:150px;
                    height:150px;
                }
    
                /* Really big emoji/sticker/gif drawer */
                [class*="positionLayer_"] { /*.positionLayer_af5dbb*/
                    height: calc(100vh - 220px);
                }
    
                /* Hide send gift button */
                button[aria-label="Send a gift"] {
                    visibility: hidden;
                    display: none;
                }`;
    var css = "";
        
    var pluginSettings = {
        useNativeEmojiSize: {
            name: "Use native emoji size",
            note: "Uploads emoji as their native size. Always scales down to 48px, the Discord emoji size, otherwise.",
            value: true
        },
        hideNitroCss: {
            name: "Hide Nitro CSS",
            note: "Removes Nitro adds using CSS.",
            value: true
        },
        enableMiscellaneousCSS:{
            name: "Enable Miscellaneous CSS properties",
            note: "Other CSS styles that you may or may not like. Bigger emojis, bigger emoji drawer, hide gift button...",
            value: false
        }
    };
        
    function Start() {        
        let emojisModule = Webpack.getByKeys('getDisambiguatedEmojiContext', 'searchWithoutFetchingLatest');
        if(emojisModule == null) { Logger.error("FreeEmojis", "emojisModule not found."); return 0; }
        Patcher.after("FreeEmojis", emojisModule, "searchWithoutFetchingLatest", (_, __, result) => {
            result.unlocked.push(...result.locked);
            result.locked = [];
        });

        let messageEmojiParserModule = Webpack.getByKeys('parse', 'parsePreprocessor', 'unparse');
        if(messageEmojiParserModule == null) { Logger.error("FreeEmojis", "messageEmojiParserModule not found."); return 0; }
        Patcher.after("FreeEmojis", messageEmojiParserModule, "parse", (_, __, result) => {
            let emojisSent = 0;
    
            if(result.invalidEmojis.length !== 0) {
                for(let emoji of result.invalidEmojis) {
                    let index = Math.floor(Math.random() * 100000);
                    replaceEmoji(result, emoji, index);
                }
                result.invalidEmojis = [];
            }
            let validNonShortcutEmojis = result.validNonShortcutEmojis;
            for (let i = 0; i < validNonShortcutEmojis.length; i++) {
                const emoji = validNonShortcutEmojis[i];
                if(!emoji.available) {
                    replaceEmoji(result, emoji, emojisSent);
                    emojisSent++;
                    validNonShortcutEmojis.splice(i, 1);
                    i--;
                }
            }
        });

        let emojiPermissionsModule = Webpack.getByKeys('getEmojiUnavailableReason');
        if(emojiPermissionsModule == null) { Logger.error("FreeEmojis", "emojiPermissionsModule not found."); return 0; }
        Patcher.instead("FreeEmojis", emojiPermissionsModule, "getEmojiUnavailableReason", () => null);
    
        function replaceEmoji(parseResult, emoji, index) {
            let emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "webp"}?quality=lossless&${index}${pluginSettings.useNativeEmojiSize.value ? "" : "&size=48"}`;
            parseResult.content = parseResult.content.replace
                (`<${emoji.animated ? "a" : ""}:${emoji.originalName || emoji.name}:${emoji.id}>`,
                 `[󠄀](${emojiUrl}) `);
        }
    
        for (let key in pluginSettings) {
            const loadedSetting = BdApi.Data.load("FreeEmojis", key);
    
            if (loadedSetting == undefined) {
                BdApi.Data.save("FreeEmojis", key, pluginSettings[key].value);
            } else {
                pluginSettings[key].value = loadedSetting;
            }
        }

        // Set CSS
        if (pluginSettings.hideNitroCss.value)
            css += hideNitroCSSString;
     
         if (pluginSettings.enableMiscellaneousCSS.value)
             css += miscellaneousCSS;
    
        DOM.addStyle('FreeEmojis', css)	
    }
    
    function Stop() {       
        DOM.removeStyle('FreeEmojis')
        Patcher.unpatchAll('FreeEmojis')
    }
    
    function GetSettingsPanel() {
        const settingsElement = () => {

            const [usePluginSettings, setPluginSettings] = useState(pluginSettings);
            const handleChange = (key, value) => {
                let updatedSettings = { ...usePluginSettings };
                updatedSettings[key].value = value
                setPluginSettings(updatedSettings);
                BdApi.Data.save("FreeEmojis", key, value);

                // Update CSS
                css = "";
                if (pluginSettings.hideNitroCss.value)
                    css += hideNitroCSSString;
             
                if (pluginSettings.enableMiscellaneousCSS.value)
                     css += miscellaneousCSS;

                // Reload CSS
                DOM.removeStyle('FreeEmojis')
                DOM.addStyle('FreeEmojis', css)
            }

            return Object.keys(pluginSettings).map((key) => {
                let { name, note, value } = pluginSettings[key];
                return createElement(
                    "div",
                    {
                        style: {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "16px 0",
                            borderBottom: "1px solid rgba(255,255,255,0.04)"
                        }
                    },
                    createElement("div", { style: { flex: 1, minWidth: 0 } },
                        createElement("div", { style: { fontWeight: 500, fontSize: 16, color: "#fff" } }, name),
                        note && createElement("div", { style: { fontSize: 13, color: "#b9bbbe", marginTop: 4, lineHeight: "1.4" } }, note)
                    ),
                    createElement(SwitchInput, {
                        value: value,
                        onChange: (v) => handleChange(key, v)
                    })
                );
            });
        };

        return createElement(settingsElement);
    }
    
    return function() { return {
        start: Start,
        stop: Stop,
        getSettingsPanel: GetSettingsPanel
    }};
    
})();
    
module.exports = FreeEmojis;
    
/*@end @*/
