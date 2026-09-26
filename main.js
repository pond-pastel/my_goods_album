import {applySettings, applyCollection, applyPageHistoryButtons} from "./apply.js";
import {addEditItemPopup} from "./add_edit.js";
import {getSymbolSvg} from "./svg.js";
const CATEGORY_LIST = {
    photo: "写真",
    acrylicStand: "アクスタ",
    uchiwa: "うちわ",
    keyRing: "キーホルダー",
    penlight: "ペンライト",
    towel: "タオル",
    badge: "バッジ",
    bag: "バッグ",
    pouch: "ポーチ",
    other: "その他"
};
/*ここからペンライト関連の定数、変数*/
const PENLIGHT_COLOR_LIST = ["#e5a", "#c9f", "#f70", "#7df", "#f9d", "#ddd", "#f23", "#fd5", "#b3c", "#5c7", "#35f"];
const PENLIGHT_ANIMATION_INTERVAL = 300;
let animationElapsedFrames = 0;
let penlightColorId = 0;
/*ここまでペンライト関連の定数、変数*/
let pageChangeHistory = [];
let disabledElesList = {};
let noFocusElesList = {};
let settings, folders, goods;
let loadedFolders = new Map();
let [currentFolderId, currentGoodsId] = [0, 0];
let [currentFolder, currentGoods] = [null, null];
let db;
let isAnimationReduced = false;
let isLoading = false;

async function applyData() {
    try {
        settings = await loadSettings();
    } catch (error) {
        console.error(`Error loading settings: ${error}`);
        showBanner("データの読み込みに失敗しました。");
        return;
    }
    if(!settings) {
        settings = {
            id: "main",
            nextFolderId: 0,
            nextGoodsId: 0
        };
        try {
            await saveSettings();
        } catch (error) {
            console.error(`Error saving settings: ${error}`);
            showBanner("データの保存に失敗しました。");
        }
    }
    applySettings(settings, isAnimationReduced, {
        changeDisplayMode: changeDisplayMode,
        changeSettingsCheckbox: changeSettingsCheckbox
    });
    await openFolder(0, "init");
}

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("my_goods_album", 1);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains("settings")) {
                db.createObjectStore("settings", {
                    keyPath: "id"
                });
            }

            if(!db.objectStoreNames.contains("folders")) {
                const store = db.createObjectStore("folders", {
                    keyPath: "id"
                });
                store.createIndex("parentId", "parentId");
                store.createIndex("bookmark", "bookmark");
            }

            if(!db.objectStoreNames.contains("goods")) {
                const store = db.createObjectStore("goods", {
                    keyPath: "id"
                });
                store.createIndex("folderId", "folderId", {
                    multiEntry: true
                });
                store.createIndex("tags", "tags", {
                    multiEntry: true
                });
            }
        };
        request.onsuccess = () => {
            db = request.result;
            resolve();
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function saveSettings() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("settings", "readwrite");
        const store = transaction.objectStore("settings");
        store.put(settings);
        
        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(transaction.error);
        }
    });
}

function saveFolder(folder, type) {
    if(isLoading) {
        return Promise.reject(new Error("loading error"));
    }
    return new Promise(async (resolve, reject) => {
        let transaction;
        let newFolder, editingFolder, folderIds;
        if(type === "add") {
            transaction = db.transaction(["settings", "folders"], "readwrite");
            const settingsStore = transaction.objectStore("settings");
            const foldersStore = transaction.objectStore("folders");
            settings.nextFolderId++;
            newFolder = {
                ...folder,
                id: settings.nextFolderId
            };
            settingsStore.put(settings);
            foldersStore.put(newFolder);
        } else if(type === "edit") {
            transaction = db.transaction("folders", "readwrite");
            const store = transaction.objectStore("folders");
            editingFolder = {
                ...folder,
                id: currentFolderId
            };
            store.put(editingFolder);
        } else if(type === "delete") {
            const targetFolderId = folder.id;
            let deleteFolders = [];
            let newFolders = await getChildFolders(targetFolderId);
            while(newFolders.length > 0) {
                deleteFolders = deleteFolders.concat(newFolders);
                let nextFolders = [];
                for(const f of newFolders) {
                    nextFolders = nextFolders.concat(await getChildFolders(f.id));
                }
                newFolders = nextFolders;
            }
            folderIds = [...deleteFolders.map((f) => f.id), targetFolderId];

            const goodsMap = new Map();
            for(const folderId of folderIds) {
                const folderGoods = await getGoods(folderId);
                for(const g of folderGoods) {
                    goodsMap.set(g.id, g);
                }
            }

            transaction = db.transaction(["folders", "goods"], "readwrite");
            const folderStore = transaction.objectStore("folders");
            const goodsStore = transaction.objectStore("goods");
            for(const folderId of folderIds) {
                folderStore.delete(folderId);
            }
            const folderIdSet = new Set(folderIds);
            for(const g of goodsMap.values()) {
                g.folderId = g.folderId.filter((id) => !folderIdSet.has(id));
                if(g.folderId.length === 0) {
                    goodsStore.delete(g.id);
                } else {
                    goodsStore.put(g);
                }
            }
        } else {
            reject(new Error(`Unknown save type: ${type}`));
            return;
        }

        transaction.oncomplete = async () => {
            if(type === "add") {
                if(loadedFolders.has(currentFolderId)) {
                    loadedFolders.get(currentFolderId).folders.push(newFolder);
                }
            } else if(type === "edit") {
                if(loadedFolders.has(currentFolder.parentId)) {
                    const folderIndex = loadedFolders.get(currentFolder.parentId).folders.findIndex((f) => f.id === currentFolderId);
                    if(folderIndex !== -1) {
                        loadedFolders.get(currentFolder.parentId).folders[folderIndex] = editingFolder;
                    }
                }
            } else if(type === "delete") {
                const parentId = currentFolder.parentId;
                console.log(parentId);
                if(loadedFolders.has(parentId)) {
                    const folderIndex = loadedFolders.get(parentId).folders.findIndex((f) => f.id === currentFolderId);
                    if(folderIndex !== -1) {
                        loadedFolders.get(parentId).folders.splice(folderIndex, 1);
                    }
                }
                for(const folderId of folderIds) {
                    if(loadedFolders.has(folderId)) {
                        loadedFolders.delete(folderId);
                    }
                }
                await pageBack(1);
            }
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(transaction.error);
        }
    });
}

function saveGoods(goods, type) {
    if(isLoading) {
        return Promise.reject(new Error("loading error"));
    }
    return new Promise((resolve, reject) => {
        let transaction;
        let newGoods, editingGoods;
        if(type === "add") {
            transaction = db.transaction(["settings", "goods"], "readwrite");
            const settingsStore = transaction.objectStore("settings");
            const goodsStore = transaction.objectStore("goods");
            settings.nextGoodsId++;
            newGoods = {
                ...goods,
                id: settings.nextGoodsId
            };
            settingsStore.put(settings);
            goodsStore.put(newGoods);
            console.log(newGoods);
        } else if(type === "edit") {
            transaction = db.transaction("goods", "readwrite");
            const store = transaction.objectStore("goods");
            editingGoods = {
                ...goods,
                id: currentGoodsId
            };
            store.put(editingGoods);
            console.log(loadedFolders);
        } else if(type === "delete") {
            transaction = db.transaction("goods", "readwrite");
            const store = transaction.objectStore("goods");
            store.delete(goods.id);
            closePopup();
        } else {
            reject(new Error(`Unknown save type: ${type}`));
            return;
        }

        transaction.oncomplete = async () => {
            if(type === "add") {
                const folderIds = goods.folderId;
                for(const folderId of folderIds) {
                    if(loadedFolders.has(folderId)) {
                        loadedFolders.get(folderId).goods.push(newGoods);
                    }
                }
            } else if(type === "edit") {
                const folderIds = goods.folderId;
                for(const folderId of folderIds) {
                    if(loadedFolders.has(folderId)) {
                        const goodsIndex = loadedFolders.get(folderId).goods.findIndex((g) => g.id === currentGoodsId);
                        if(goodsIndex !== -1) {
                            loadedFolders.get(folderId).goods[goodsIndex] = editingGoods;
                        } else {
                            loadedFolders.get(folderId).goods.push(editingGoods);
                        }
                    }
                }
                const deleteIds = currentGoods.folderId.filter((g) => !folderIds.includes(g));
                for(const folderId of deleteIds) {
                    if(loadedFolders.has(folderId)) {
                        const goodsIndex = loadedFolders.get(folderId).goods.findIndex((g) => g.id === currentGoodsId);
                        if(goodsIndex !== -1) {
                            loadedFolders.get(folderId).goods.splice(goodsIndex, 1);
                        }
                    }
                }
            } else if(type === "delete") {
                const folderIds = goods.folderId;
                for(const folderId of folderIds) {
                    if(loadedFolders.has(folderId)) {
                        const folderIndex = loadedFolders.get(folderId).goods.findIndex((g) => g.id === currentGoodsId);
                        if(folderIndex !== -1) {
                            loadedFolders.get(folderId).goods.splice(folderIndex, 1);
                        }
                    }
                }
                await openFolder(currentFolderId, "reload");
            }
            resolve();
        };

        transaction.onerror = () => {
            reject(transaction.error);
        };

        transaction.onabort = () => {
            reject(transaction.error);
        }
    });
}

function loadSettings() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("settings", "readonly");
        const store = transaction.objectStore("settings");
        const request = store.get("main");
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getChildFolders(parentId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("folders", "readonly");
        const store = transaction.objectStore("folders");
        const index = store.index("parentId");
        const request = index.getAll(parentId);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getGoods(folderId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("goods", "readonly");
        const store = transaction.objectStore("goods");
        const index = store.index("folderId");
        const request = index.getAll(folderId);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getCurrentFolder(folderId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("folders", "readonly");
        const store = transaction.objectStore("folders");
        const request = store.get(folderId);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function getCurrentGoods(goodsId) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("goods", "readonly");
        const store = transaction.objectStore("goods");
        const request = store.get(goodsId);
        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = () => {
            reject(request.error);
        };
    });
}

function showLoadingMark() {
    isLoading = true;
    const itemLoadingMessageEle = document.getElementById("item-loading-message");
    itemLoadingMessageEle.style.removeProperty("display");
    const folderGoodsGroupEle = document.getElementById("folder-goods-group");
    folderGoodsGroupEle.style.display = "none";
}

function hideLoadingMark(result) {
    isLoading = false;
    const itemLoadingMessageEle = document.getElementById("item-loading-message");
    itemLoadingMessageEle.style.display = "none";
    if(result === "success") {
        const folderGoodsGroupEle = document.getElementById("folder-goods-group");
        folderGoodsGroupEle.style.removeProperty("display");
    }
}

async function openFolder(id, type) {
    showLoadingMark();
    try {
        if(type === "open") {
            pageChangeHistory.push(currentFolderId);
        }
        console.log(pageChangeHistory);
        currentFolderId = id;
        currentFolder = await getCurrentFolder(id);
        if(!loadedFolders.has(id)) {
            folders = await getChildFolders(id);
            goods = await getGoods(id);
            loadedFolders.set(id, {
                folders: folders,
                goods: goods
            });
            console.log(loadedFolders);
        } else {
            const lFolders = loadedFolders.get(id)
            folders = lFolders.folders;
            goods = lFolders.goods;
        }
        console.log(folders);
        await applyCollection(folders, goods, currentFolder, settings, CATEGORY_LIST, {
            getSymbolSvg: getSymbolSvg,
            openFolder: openFolder,
            openGoods: openGoods,
            getContrastColor: getContrastColor,
            getImagePosition: getImagePosition
        });
        if(type !== "edit") {
            await applyPageHistoryButtons(pageChangeHistory, id, {
                getCurrentFolder: getCurrentFolder,
                pageBack: pageBack
            });
        }
        console.log(folders, goods);
        const folderName = currentFolder?.name;
        const folderNameEle = document.getElementById("folder-name");
        if(folderNameEle) {
            if(id === 0) {
                folderNameEle.textContent = "My Collections";
            } else {
                folderNameEle.textContent = (folderName ?? "") === "" ? "アルバム" : folderName;
            }
        } else {
            console.error("Folder name element not found");
        }
        const folderActionGroupEle = document.getElementById("folder-action-group");
        if(folderActionGroupEle) {
            if(id === 0) {
                folderActionGroupEle.style.display = "none";
            } else {
                folderActionGroupEle.style.removeProperty("display");
            }
        }
        const folderJumpButtonEle = document.getElementById("folder-jump-button");
        if(folderJumpButtonEle) {
            if(id === 0) {
                folderJumpButtonEle.textContent = "My Collections";
            } else {
                folderJumpButtonEle.textContent = (folderName ?? "") === "" ? "アルバム" : folderName;
            }
        } else {
            console.error("Folder jump button element not found");
        }
        let folderColor = currentFolder?.color;
        const colorUse = currentFolder?.colorUse;
        if(!(colorUse ?? true)) {
            folderColor = null;
        }
        if(folderColor && (colorUse ?? true)) {
            const textColor = getContrastColor(folderColor, "text");
            const overviewColor = getContrastColor(folderColor, "overview");
            const overviewBackgroundColor = getContrastColor(folderColor, "overview-background");
            document.documentElement.style.setProperty("--folder-color", folderColor);
            document.documentElement.style.setProperty("--folder-text-color", textColor);
            document.documentElement.style.setProperty("--folder-overview-color", overviewColor);
            document.documentElement.style.setProperty("--folder-overview-background-color", overviewBackgroundColor);
        } else {
            document.documentElement.style.removeProperty("--folder-color");
            document.documentElement.style.removeProperty("--folder-text-color");
            document.documentElement.style.removeProperty("--folder-overview-color");
            document.documentElement.style.removeProperty("--folder-overview-background-color");
        }
        if(!["init", "toggle-hide-image", "reload"].includes(type)) {
            autoScroll("folder-goods-box");
        }
        const pageHistoryGroupEle = document.getElementById("page-history-group");
        if(pageHistoryGroupEle) {
            if(pageChangeHistory.length === 0) {
                pageHistoryGroupEle.style.display = "none";
            } else {
                pageHistoryGroupEle.style.display = null;
            }
        }
        hideLoadingMark("success");
    } catch (error) {
        console.error(`Error opening folder: ${error}`);
        const itemLoadingErrorMessageEle = document.getElementById("item-loading-error-message");
        if(itemLoadingErrorMessageEle) {
            itemLoadingErrorMessageEle.style.display = "block";
        }
        const folderGoodsGroupEle = document.getElementById("folder-goods-group");
        if(folderGoodsGroupEle) {
            folderGoodsGroupEle.style.display = "none";
        }
        showBanner("アルバムの読み込みに失敗しました。");
        hideLoadingMark("failure");
    }
}

async function openGoods(id) {
    showLoadingMark();
    try {
        currentGoodsId = id;
        currentGoods = await getCurrentGoods(id);
        const popupContent = document.createElement("div");
        const goodsImage = currentGoods?.image;
        const isImageHidden = settings?.checkbox?.["privacy-protection"];
        const imageGroup = document.createElement("div");
        imageGroup.classList.add("image-group");
        const goodsName = currentGoods?.name;
        const goodsCategory = currentGoods?.category;
        if(goodsImage && !isImageHidden) {
            const url = URL.createObjectURL(goodsImage);
            const img = document.createElement("img");
            img.classList.add("original-goods-image");
            img.src = url;
            img.alt = `${goodsName}の画像`;
            img.onload = () => {
                URL.revokeObjectURL(url);
            }
            imageGroup.appendChild(img);
        } else {
            const symbolSvg = getSymbolSvg(goodsCategory, "import-symbol-svg");
            imageGroup.appendChild(symbolSvg);
        }
        if(goodsImage && isImageHidden) {
            const hiddenMessage = document.createElement("div");
            hiddenMessage.classList.add("hidden-message");
            hiddenMessage.textContent = "画像が非表示になっています。";
            imageGroup.appendChild(hiddenMessage);
        }
        popupContent.append(imageGroup);
        const name = document.createElement("div");
        name.classList.add("goods-name");
        name.textContent = goodsName;
        popupContent.append(name);
        const goodsActionGroup = document.createElement("div");
        goodsActionGroup.classList.add("goods-action-group");
        const deleteGoodsButton = document.createElement("button");
        deleteGoodsButton.classList.add("delete-goods-button");
        deleteGoodsButton.textContent = "このグッズを削除";
        deleteGoodsButton.addEventListener("click", () => {
            if(settings?.checkbox?.["calculation-for-deletion"]) {
                const messageLabel = document.createElement("label");
                const input = document.createElement("input");
                input.type = "number";
                input.inputMode = "numeric";
                input.name = "calculation";
                input.min = "1";
                input.max = "81";
                const a = Math.floor(Math.random() * 9) + 1;
                const b = Math.floor(Math.random() * 9) + 1;
                messageLabel.append(`「${currentGoods.name}」を削除するために計算問題を解いてください: ${a} × ${b} = `, input);
                showBanner(messageLabel, [{
                    text: "回答する",
                    fn: deleteAfterCalculation,
                    arg: [a, b, input, "goods"]
                }, {
                    text: "キャンセル"
                }]);
            } else {
                showBanner(`「${currentGoods.name}」を削除しますか？`, [{
                    text: "削除",
                    fn: saveGoods,
                    arg: [currentGoods, "delete"]
                }, {
                    text: "キャンセル"
                }]);
            }
        });
        const goodsEditButton = document.createElement("button");
        goodsEditButton.classList.add("edit-goods-button");
        goodsEditButton.textContent = "このグッズを編集";
        goodsEditButton.addEventListener("click", () => {
            addEditItemPopup(settings, currentFolderId, currentFolder, currentGoods, loadedFolders, CATEGORY_LIST, "goods", "edit", {
                showBanner: showBanner,
                showPopup: showPopup,
                getSymbolSvg: getSymbolSvg,
                getChildFolders: getChildFolders,
                getCurrentFolder: getCurrentFolder,
                saveFolder: saveFolder,
                saveGoods: saveGoods,
                openFolder: openFolder,
                getImagePosition: getImagePosition
            });
        });
        goodsActionGroup.append(deleteGoodsButton, goodsEditButton);
        popupContent.append(goodsActionGroup);
        const goodsDescription = currentGoods?.description;
        if(goodsDescription) {
            const goodsDescriptionList = goodsDescription.split("\n");
            const description = document.createElement("p");
            goodsDescriptionList.forEach((line) => {
                const lineEle = document.createElement("div");
                lineEle.textContent = line;
                description.append(lineEle);
            });
            popupContent.append(description);
        }
        const goodsCount = currentGoods?.count;
        const count = document.createElement("p");
        count.textContent = `所持数: ${goodsCount}個`;
        popupContent.append(count);
        const goodsTags = currentGoods?.tags;
        if((goodsTags ?? []).length > 0) {
            const tags = document.createElement("div");
            tags.classList.add("tag-group");
            goodsTags.forEach((tag) => {
                const tagEle = document.createElement("span");
                tagEle.classList.add("tag");
                tagEle.textContent = tag;
                tags.append(tagEle);
            });
            popupContent.append(tags);
        }
        const category = document.createElement("div");
        category.classList.add("goods-category");
        category.textContent = `カテゴリ: ${goodsCategory ? CATEGORY_LIST[goodsCategory] : "不明"}`;
        popupContent.append(category);
        showPopup(popupContent);
    } catch (error) {
        console.error(`Error opening goods: ${error}`);
        showBanner("グッズの読み込みに失敗しました。");
    } finally {
        hideLoadingMark("success");
    }
}

function getContrastColor(hexColor, mode) {
    const color = hexColor ?? "#ffc0cb";
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    if(mode === "overview") {
        return yiq >= 128 ? "#555" : "#aaa";
    } else if(mode === "overview-background") {
        return yiq >= 128 ? "#aaa" : "#555";
    } else {
        return yiq >= 128 ? "#000" : "#fff";
    }
}

function getImagePosition(position) {
    const POSITION_LIST = {
        center: "center center",
        left: "left center",
        right: "right center",
        top: "center top",
        bottom: "center bottom"
    };
    return POSITION_LIST[position] ?? "center center";
}

async function pageBack(backCount) {
    let openId = 0;
    if(pageChangeHistory.length > 0) {
        openId = pageChangeHistory.at(backCount * -1);
        pageChangeHistory.splice(backCount * -1);
    }
    console.log(openId);
    await openFolder(openId, "back");
}

function deleteAfterCalculation(a, b, input, target) {
    const value = parseInt(input?.value);
    const answer = a * b;
    console.log(Number.isFinite(value));
    if(!Number.isFinite(value) || answer !== value) {
        showBanner("不正解のため削除できませんでした。");
        return false;
    } else {
        if(target === "folder") {
            saveFolder(currentFolder, "delete");
        } else if(target === "goods") {
            saveGoods(currentGoods, "delete");
        } else {
            showBanner("エラーが発生しました。");
            return false;
        }
    }
}

async function changeSettingsCheckbox(checkbox) {
    const id = checkbox.id;
    const checked = checkbox.checked;
    if(!settings.checkbox) {
        settings.checkbox = {};
    }
    settings.checkbox[id] = checked;
    switch(id) {
        case "no-folder-color":
            if(checked) {
                const folderGoodsBoxEle = document.getElementById("folder-goods-box");
                folderGoodsBoxEle.classList.add("no-folder-color");
                const popupEle = document.getElementById("popup");
                popupEle.classList.add("no-folder-color");
            } else {
                const noFolderColorEles = document.querySelectorAll(".no-folder-color");
                noFolderColorEles.forEach((ele) => {
                    ele.classList.remove("no-folder-color");
                });
            }
            break;

        case "privacy-protection":
            openFolder(currentFolderId, "toggle-hide-image");
            break;

        case "calculation-for-deletion":
            break;

        default:
            return;
    }
    await saveSettings();
}

async function changeAppearanceMode(target) {
    const targetEle = document.getElementById(target);
    if(targetEle) {
        targetEle.checked = true;
    }
    settings.appearance = target;
    await saveSettings();
}

function showDetails(target, type = "auto") {
    const targetEle = document.getElementById(target);
    if(targetEle) {
        switch(type) {
            case "open":
                targetEle.classList.add("open");
                break;

            case "close":
                targetEle.classList.remove("open");
                break;

            default:
                targetEle.classList.toggle("open");
                break;
        }
        if(target === "details-menu-bg") {
            const detailsMenuButtonEle = document.getElementById("details-menu-button");
            if(targetEle.classList.contains("open")) {
                detailsMenuButtonEle.title = "メニューを閉じる";
                detailsMenuButtonEle.ariaLabel = "メニューを閉じる";
                if(document.hasFocus()) {
                    const topJumpButtonEle = document.getElementById("top-jump-button");
                    topJumpButtonEle.focus();
                }
                if((disabledElesList.detailsMenu?.length ?? 0) === 0) {
                    openModal(":not(.details-menu-button)", "details-menu");
                }
            } else {
                detailsMenuButtonEle.title = "メニューを開く";
                detailsMenuButtonEle.ariaLabel = "メニューを開く";
                closeModal("details-menu");
            }
        }
    } else {
        console.error("Element not found");
    }
}

function showBanner(ele, buttons) {
    const activeEle = document.activeElement;
    let focus = false;
    if(activeEle) {
        focus = true;
    }
    if((disabledElesList.banner?.length ?? 0) === 0) {
        openModal("", "banner");
    }
    const bannerContentEle = document.getElementById("banner-content");
    bannerContentEle.innerHTML = "";
    bannerContentEle.append(ele);
    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("button-group");
    buttonGroup.classList.add("banner-button-group");
    (buttons ?? [{text: "OK"}]).forEach((b) => {
        const button = document.createElement("button");
        button.classList.add("banner-button");
        button.textContent = b.text ?? "OK";
        button.addEventListener("click", () => {
            let close = true;
            if(b.fn) {
                if(b.arg) {
                    if(Array.isArray(b.arg)) {
                        close = b.fn(...b.arg);
                    } else {
                        close = b.fn(b.arg);
                    }
                } else {
                    close = b.fn();
                }
            }
            console.log(close);
            closeBanner(close);
        });
        buttonGroup.append(button);
    });
    bannerContentEle.append(buttonGroup);
    const bannerEle = document.getElementById("banner");
    bannerEle.classList.add("open");
    if(focus) {
        const targetButtonEles = document.querySelector(".banner-button");
        if(targetButtonEles) {
            targetButtonEles.focus();
        }
    }
}

function closeBanner(close = true) {
    if(close !== false) {
        const bannerEle = document.getElementById("banner");
        bannerEle.classList.remove("open");
        const bannerContentEle = document.getElementById("banner-content");
        bannerContentEle.innerHTML = "";
        closeModal("banner");
    }
}

function showPopup(ele, buttons) {
    if((disabledElesList.popup?.length ?? 0) === 0) {
        openModal("", "popup");
    }
    const blurEle = document.getElementById("blur");
    const popupEle = document.getElementById("popup");
    popupEle.innerHTML = "";
    ele.classList.add("popup-content");
    popupEle.append(ele);
    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("button-group");
    buttonGroup.classList.add("popup-button-group");
    (buttons ?? [{text: "OK"}]).forEach((b) => {
        const button = document.createElement("button");
        button.classList.add("popup-button");
        button.textContent = b.text ?? "OK";
        button.addEventListener("click", () => {
            let close = true;
            if(b.fn) {
                if(b.arg) {
                    if(Array.isArray(b.arg)) {
                        close = b.fn(...b.arg);
                    } else {
                        close = b.fn(b.arg);
                    }
                } else {
                    close = b.fn();
                }
            }
            closePopup(close);
        });
        buttonGroup.append(button);
    });
    popupEle.append(buttonGroup);
    blurEle.classList.add("show");
}

function closePopup(close = true) {
    if(close !== false) {
        const blurEle = document.getElementById("blur");
        blurEle.classList.remove("show");
        const popupEle = document.getElementById("popup");
        popupEle.innerHTML = "";
        closeModal("popup");
    }
}

function openModal(classesToExclude = "", type) {
    const validEles = Array.from(document.querySelectorAll(`button:not(:disabled)${classesToExclude}, input:not(:disabled)${classesToExclude}, textarea:not(:disabled)${classesToExclude}, select:not(:disabled)${classesToExclude}`));
    if (!disabledElesList[type]) {
        disabledElesList[type] = [];
    }
    disabledElesList[type].push(validEles);
    validEles.forEach((v) => {
        v.disabled = true;
    });
    const canFocusEles = Array.from(document.querySelectorAll("a:not([tabindex='-1'])"));
    if (!noFocusElesList[type]) {
        noFocusElesList[type] = [];
    }
    noFocusElesList[type].push(canFocusEles);
    canFocusEles.forEach((f) => {
        f.setAttribute("tabindex", "-1");
    });
}

function closeModal(type) {
    const disabledEles = disabledElesList[type]?.pop();
    if(disabledEles) {
        disabledEles.forEach((d) => {
            if(!d.classList.contains("disabled")) {
                d.disabled = false;
            }
        });
    }
    const noFocusEles = noFocusElesList[type]?.pop();
    if(noFocusEles) {
        noFocusEles.forEach((f) => {
            f.removeAttribute("tabindex");
        });
    }
}

function autoScroll(target, behavior = "smooth") {
    const targetEle = document.getElementById(target);
    if(targetEle) {
        const y = targetEle.getBoundingClientRect().y + window.pageYOffset - 50;
        window.scrollTo({
            top: y,
            behavior: (isAnimationReduced ? "auto" : behavior)
        });
    }
}

async function changeDisplayMode(mode) {
    const boxEle = document.getElementById("folder-goods-box");
    switch(mode) {
        case "grid":
            boxEle.classList.add("grid-display");
            break;
        case "list":
            boxEle.classList.remove("grid-display");
            break;
    }
    settings.displayMode = mode;
    try {
        await saveSettings();
    } catch (error) {
        console.error("Error saving settings:", error);
        showBanner("設定の保存に失敗しました。");
    }
}

function toggleQAndADisplay(category, checked) {
    const targetQAndAGroupEles = document.querySelectorAll(`.${category}`);
    if (targetQAndAGroupEles) {
        targetQAndAGroupEles.forEach((t) => {
            t.style.display = checked ? null : "none";
        });
    }
}

function penlightAnimation() {
    animationElapsedFrames++;
    if(animationElapsedFrames >= PENLIGHT_ANIMATION_INTERVAL) {
        penlightColorId = (penlightColorId + 1) % PENLIGHT_COLOR_LIST.length;
        animationElapsedFrames = 0;
        const penlightColorSvgEles = document.querySelectorAll(".penlight-color-svg");
        penlightColorSvgEles.forEach((p) => {
            p.style.fill = PENLIGHT_COLOR_LIST[penlightColorId];
        });
    }
    if(!isAnimationReduced) {
        requestAnimationFrame(penlightAnimation);
    }
}

function toggleAnimationReduction(reduced) {
    isAnimationReduced = reduced;
    console.log(reduced);
    const animationReduceDiscriptionEles = document.querySelectorAll(".animation-reduce-description");
    const noFolderColorCheckboxEle = document.getElementById("no-folder-color");
    if(!reduced) {
        animationReduceDiscriptionEles.forEach((d) => {
            d.style.display = "none";
        });
        noFolderColorCheckboxEle.checked = settings?.checkbox?.["no-folder-color"] ?? false;
        if((disabledElesList.popup?.length ?? 0) === 0 && (disabledElesList.banner?.length ?? 0) === 0) {
            noFolderColorCheckboxEle.disabled = false;
        }
        noFolderColorCheckboxEle.classList.remove("disabled");
        penlightAnimation();
    } else {
        animationReduceDiscriptionEles.forEach((d) => {
            d.style.display = null;
        });
        noFolderColorCheckboxEle.checked = true;
        noFolderColorCheckboxEle.disabled = true;
        noFolderColorCheckboxEle.classList.add("disabled");
    }
}

window.onload = async function() {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    toggleAnimationReduction(query.matches);
    query.addEventListener("change", (e) => {
        toggleAnimationReduction(e.matches);
    });
    try {
        await initDB();
        await applyData();
    } catch (error) {
        console.error("Error initializing database:", error);
        showBanner("データベースの初期化に失敗しました。");
    }
    const detailsButtonEles = document.querySelectorAll(".details-button");
    detailsButtonEles.forEach((d) => {
        d.addEventListener("click", () => {
            showDetails(d.dataset.target);
        });
    });
    const addNewFolderButtonEle = document.getElementById("add-new-folder-button");
    addNewFolderButtonEle.addEventListener("click", () => {
        addEditItemPopup(settings, currentFolderId, currentFolder, currentGoods, loadedFolders, CATEGORY_LIST, "folder", "add", {
            showBanner: showBanner,
            showPopup: showPopup,
            getSymbolSvg: getSymbolSvg,
            getChildFolders: getChildFolders,
            getCurrentFolder: getCurrentFolder,
            saveFolder: saveFolder,
            saveGoods: saveGoods,
            openFolder: openFolder,
            getImagePosition: getImagePosition
        });
    });
    const addNewGoodsButtonEle = document.getElementById("add-new-goods-button");
    addNewGoodsButtonEle.addEventListener("click", () => {
        addEditItemPopup(settings, currentFolderId, currentFolder, currentGoods, loadedFolders, CATEGORY_LIST, "goods", "add", {
            showBanner: showBanner,
            showPopup: showPopup,
            getSymbolSvg: getSymbolSvg,
            getChildFolders: getChildFolders,
            getCurrentFolder: getCurrentFolder,
            saveFolder: saveFolder,
            saveGoods: saveGoods,
            openFolder: openFolder,
            getImagePosition: getImagePosition
        });
    });
    const deleteFolderButtonEle = document.getElementById("delete-folder-button");
    if(deleteFolderButtonEle) {
        deleteFolderButtonEle.addEventListener("click", () => {
            console.log(settings?.checkbox?.["calculation-for-deletion"]);
            if(settings?.checkbox?.["calculation-for-deletion"]) {
                const messageLabel = document.createElement("label");
                const input = document.createElement("input");
                input.name = "calculation";
                input.type = "number";
                input.inputMode = "numeric";
                input.min = "1";
                input.max = "81";
                const a = Math.floor(Math.random() * 9) + 1;
                const b = Math.floor(Math.random() * 9) + 1;
                messageLabel.append(`アルバム「${currentFolder.name}」を削除するには計算問題を解いてください: ${a} × ${b} = `, input);
                showBanner(messageLabel, [{
                    text: "回答する",
                    fn: deleteAfterCalculation,
                    arg: [a, b, input, "folder"]
                }, {
                    text: "キャンセル"
                }]);
            } else {
                showBanner(`アルバム「${currentFolder.name}」を削除しますか？`, [{
                    text: "削除",
                    fn: saveFolder,
                    arg: [currentFolder, "delete"]
                }, {
                    text: "キャンセル"
                }]);
            }
        });
    }
    const editFolderButtonEle = document.getElementById("edit-folder-button");
    if(editFolderButtonEle) {
        editFolderButtonEle.addEventListener("click", () => {
            addEditItemPopup(settings, currentFolderId, currentFolder, currentGoods, loadedFolders, CATEGORY_LIST, "folder", "edit", {
                showBanner: showBanner,
                showPopup: showPopup,
                getSymbolSvg: getSymbolSvg,
                getChildFolders: getChildFolders,
                getCurrentFolder: getCurrentFolder,
                saveFolder: saveFolder,
                saveGoods: saveGoods,
                openFolder: openFolder,
                getImagePosition: getImagePosition
            });
        });
    }
    const pageBackButtonEle = document.getElementById("page-back-button");
    pageBackButtonEle.addEventListener("click", async () => {
        await pageBack(1);
    });
    const displayModeSelectEle = document.getElementById("display-mode-select");
    displayModeSelectEle.addEventListener("change", () => {
        changeDisplayMode(displayModeSelectEle.value);
    });
    const jumpButtonEles = document.querySelectorAll(".jump-button");
    jumpButtonEles.forEach((j) => {
        j.addEventListener("click", () => {
            autoScroll(j.dataset.jumpPoint);
            showDetails("details-menu-bg", "close");
        });
    });
    const settingsCheckboxEles = document.querySelectorAll(".settings-checkbox");
    settingsCheckboxEles.forEach((s) => {
        s.addEventListener("change", () => {
            changeSettingsCheckbox(s);
        });
    });
    const appearanceModeButtonEles = document.querySelectorAll(".appearance-mode-button");
    appearanceModeButtonEles.forEach((b) => {
        b.addEventListener("click", () => {
            changeAppearanceMode(b.dataset.target);
        });
    });
    const qAndACategoryCheckboxEles = document.querySelectorAll(".q-and-a-category-checkbox");
    qAndACategoryCheckboxEles.forEach((c) => {
        c.addEventListener("change", () => {
            toggleQAndADisplay(c.id, c.checked);
        });
    });
    penlightAnimation();
    //ここから下test
    const testShowBannerEle = document.getElementById("test-show-banner-button");
    if(testShowBannerEle) {
        testShowBannerEle.addEventListener("click", () => {
            const ele = document.createElement("div");
            ele.textContent = "Show Banner test";
            showBanner(ele);
        });
    }
    const testShowPopupEle = document.getElementById("test-show-popup-button");
    if(testShowPopupEle) {
        testShowPopupEle.addEventListener("click", () => {
            const ele = document.createElement("div");
            ele.textContent = "Show Popup test";
            showPopup(ele);
        });
    }
}

if("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(console.error);
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        location.reload();
    });
}

if(navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((persisted) => {
        if(persisted) {
            console.log("Storage will not be cleared except by explicit user action");
        } else {
            console.log("Storage may be cleared by the UA under storage pressure");
        }
    }).catch(console.error);
}