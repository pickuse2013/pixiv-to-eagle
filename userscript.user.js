// ==UserScript==
// @name                Save Pixiv images to Eagle
// @name:zh             批量导入 Pixiv 图片到 Eagle
// @name:zh-CN          批量导入 Pixiv 图片到 Eagle
// @name:zh-TW          批次導入 Pixiv 圖片到 Eagle

// @description         Launch a script on Pixiv that automatically converts all images on the page into large images (with links, names) to be added to the Eagle App.
// @description:zh      请确保你的网路环境可以正常访问 Pixiv，如果设备网路无法访问，此脚本将无法正常运作。在 Pixiv 页面启动脚本，此脚本会自动将页面中所有图片转换成大图（包含链接、名称），添加至 Eagle App。
// @description:zh-CN   请确保你的网路环境可以正常访问 Pixiv，如果设备网路无法访问，此脚本将无法正常运作。在 Pixiv 页面启动脚本，此脚本会自动将页面中所有图片转换成大图（包含链接、名称），添加至 Eagle App。
// @description:zh-TW   在 Pixiv 畫版頁面啓動腳本，此腳本會自動將頁面中所有圖片轉換成大圖（包含鏈接、名稱），添加至 Eagle App。

// @author       pickuse2013
// @namespace    https://pickuse2013.github.io/
// @homepageURL  https://github.com/pickuse2013/pixiv-to-eagle
// @supportURL   https://github.com/pickuse2013/pixiv-to-eagle
// @icon         https://www.pixiv.net/favicon.ico
// @license      MIT License

// @match        https://www.pixiv.net/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @run-at       context-menu

// @require      https://code.jquery.com/jquery-3.5.1.min.js
// @require      https://gist.githubusercontent.com/BrockA/2625891/raw/9c97aa67ff9c5d56be34a55ad6c18a314e5eb548/waitForKeyElements.js

// @date         08/28/2020
// @modified     01/21/2022
// @version      0.0.2

// ==/UserScript==
'use strict';

(function () {

    $("body").append(`<div id="save-to-eagle-dialog" style="background-color: aquamarine; display: block; position: fixed; top: 200px; width: 300px;  padding: 25px 30px; margin: 5% auto; left: 0; right: 0; text-align: center; box-shadow: 4px 4px 4px 3px rgba(0, 0, 0, 0.2); border-radius: 10px;">prepare to start ...</div>`);

    if (location.href.indexOf("pixiv.") === -1) {
        alert("This script only works on pixiv.net.");
        return;
    }

    // Eagle API 服务器位置
    const EAGLE_SERVER_URL = "http://localhost:41595";
    const EAGLE_IMPORT_API_URL = `${EAGLE_SERVER_URL}/api/item/addFromURL`;
    const EAGLE_CREATE_FOLDER_API_URL = `${EAGLE_SERVER_URL}/api/folder/create`;

    // Pixiv 当前图片、链接命名规则
    const SELECTOR_IMAGE = "section ul li a img[class]";
    const SELECTOR_DIALOG = "div#save-to-eagle-dialog"

    // 是否要使用Pixiv的tags
    const SUPPORT_TAGS = false;

    let DOWNLOAD_COUNTER = 0;
    let TOTAL_COUNTER = 0;
    let FINISH = false;

    // 创建文件夹
    var createFolder = function (folderName, callback) {
        GM_xmlhttpRequest({
            url: EAGLE_CREATE_FOLDER_API_URL,
            method: "POST",
            data: JSON.stringify({
                folderName: folderName
            }),
            onload: function (response) {
                try {
                    var result = JSON.parse(response.response);
                    if (result.status === "success" && result.data && result.data.id) {
                        callback(undefined, result.data);
                    } else {
                        callback(true);
                    }
                } catch (err) {
                    callback(true);
                }
            }
        });
    };

    // 将图片添加至 Eagle
    function addImageToEagle(data) {
        GM_xmlhttpRequest({
            url: EAGLE_IMPORT_API_URL,
            method: "POST",
            data: JSON.stringify(data),
            onload: function (response) {}
        });
    }

    function updateDialog()
    {
        $(SELECTOR_DIALOG).html(`Downloading...<br>${DOWNLOAD_COUNTER} download.`);
        //$(SELECTOR_DIALOG).html(`Downloading...<br>${DOWNLOAD_COUNTER}/${TOTAL_COUNTER}`);

        if(FINISH == true)
        {
            $(SELECTOR_DIALOG).html(`Download<br>Complate!`);
            setTimeout(function(){
                $(SELECTOR_DIALOG).fadeOut();
            }, 1000);
        }
    }

    function getImages(folder) {
        DOWNLOAD_COUNTER = 0;
        TOTAL_COUNTER = 0;
        $(SELECTOR_IMAGE).each(function (i, e) {
            let index = i;
            let IMAGE_LINK_URL = $(e).closest('a')[0].href;
            let IMAGE_AMOUNT = $(e).closest("a").find("div:first span").text();
            if (IMAGE_AMOUNT == "") {
                IMAGE_AMOUNT = 1;
            } else {
                IMAGE_AMOUNT = IMAGE_AMOUNT * 1;
            }

            TOTAL_COUNTER += IMAGE_AMOUNT;

            updateDialog();

            $.get(IMAGE_LINK_URL, function (html) {
                var parser = new DOMParser();
                var doc = parser.parseFromString(html, "text/html");
                var preloadData = doc.querySelectorAll('meta#meta-preload-data')[0];

                let content = JSON.parse(preloadData.content);

                let IMAGE_ID = Object.keys(content.illust)[0];
                let IMAGE_URL = content.illust[IMAGE_ID].urls.original;
                let IMAGE_TYPE = content.illust[IMAGE_ID].urls.original.split(".").pop();
                let IMAGE_TITLE = content.illust[IMAGE_ID].title
                let IMAGE_DESCRIPTION = content.illust[IMAGE_ID].alt;
                let IMAGE_WEBSITE = content.illust[IMAGE_ID].extraData.meta.canonical;
                let IMAGE_TAGS = Object.values(content.illust[IMAGE_ID].tags.tags).map(item => item.tag);

                for (let i = 0; i <= (IMAGE_AMOUNT - 1); i++) {
                    let DOWNLOAD_IMAGE_URL = IMAGE_URL.replace("p0", "p" + i);
                    console.log("prepare download: ", DOWNLOAD_IMAGE_URL)

                    let image = {
                        "url": DOWNLOAD_IMAGE_URL,
                        "name": IMAGE_TITLE,
                        "website": IMAGE_WEBSITE,
                        "annotation": IMAGE_DESCRIPTION,
                        "folderId": folder.id,
                        "headers": {
                            "referer": IMAGE_WEBSITE
                        }
                    };

                    if(SUPPORT_TAGS)
                    {
                        image.tags = IMAGE_TAGS;
                    }

                    DOWNLOAD_COUNTER++;
                    addImageToEagle(image);
                    console.log(index, $(SELECTOR_IMAGE).length - 1);
                    updateDialog();

                }
                if(index == $(SELECTOR_IMAGE).length - 1){
                    FINISH = true;
                }
                updateDialog();
            });
        });


    }

    // 脚本开始
    // 创建本次保存使用文件夹
    var folderName = document.querySelector("h1") && document.querySelector("h1").innerText || "Pixiv";

    console.log("Pixiv to Eagle")

    waitForKeyElements(SELECTOR_IMAGE + ':first', actionFunction, true);

    function actionFunction() {
        createFolder(folderName, function (err, folder) {
            if (folder) {
                getImages(folder);
            } else {
                alert("软件尚未打开，或当前软件版本不支持，需至 Eagle 官网下载，手动重新安装最新版本");
            }
        });
    }
})();