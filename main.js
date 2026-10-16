import {applySettings, applyCollection, applyPageHistoryButtons, applyCustomPenlight} from "./apply.js";
import {addEditItemPopup, addEditPenlightPopup} from "./add_edit.js";
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
//ここからペンライト関連の定数、変数
const PENLIGHT_COLOR_LIST = ["#e5a", "#c9f", "#f70", "#7df", "#f9d", "#ddd", "#f23", "#fd5", "#b3c", "#5c7", "#35f"];
const PENLIGHT_ANIMATION_INTERVAL = 3000;
let customPenlightColorList = null;
let customPenlightAnimationInterval = null;
let animationElapsedInterval = 0;
let animationStartDate = null
let penlightColorId = 0;
//ここまでペンライト関連の定数、変数
let pageChangeHistory = [];
let disabledElesList = {};
let noFocusElesList = {};
let settings, folders, goods;
let loadedFolders = new Map();
let bookmarkFolders = new Map();
let [currentFolderId, currentGoodsId] = [0, 0];
let [currentFolder, currentGoods] = [null, null];
let isShowGoods = false;
let swipeStartPos;
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
            nextGoodsId: 0,
            nextPenlightId: 0
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
    applyCustomPenlight(settings);
    if(settings.penlight?.usePenlightId) {
        const penlightSelectEle = document.getElementById("penlight-select");
        changePenlightAnimation();
    }
    const bookmarkFolderList = await getBookmarkFolders();
    bookmarkFolders = new Map(bookmarkFolderList.map((folder) => [folder.id, folder]));
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

async function saveFolder(folder, type) {
    if(folder.image) {
        const buffer = await folder.image.arrayBuffer();
        folder.image = new Blob ([buffer], {
            type: folder.image.type
        });
    }
    if(isLoading) {
        return Promise.reject(new Error("loading error"));
    }
    if(folder.id < 1) {
        return Promise.reject(new Error("Invalid folder ID"));
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
            if(Object.hasOwn(folder, "id")) {
                editingFolder = folder;
            } else {
                editingFolder = {
                    ...folder,
                    id: currentFolderId
                };
            }
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
                if(folder.bookmark === 1) {
                    bookmarkFolders.set(newFolder.id, newFolder);
                }
            } else if(type === "edit") {
                if(loadedFolders.has(editingFolder?.parentId)) {
                    const folderIndex = loadedFolders.get(editingFolder.parentId).folders.findIndex((f) => f.id === editingFolder.id);
                    if(folderIndex !== -1) {
                        loadedFolders.get(editingFolder.parentId).folders[folderIndex] = editingFolder;
                    }
                }
                if(folder.bookmark === 1) {
                    bookmarkFolders.set(editingFolder.id, editingFolder);
                } else if(bookmarkFolders.has(editingFolder.id)) {
                    bookmarkFolders.delete(editingFolder.id);
                }
            } else if(type === "delete") {
                const parentId = currentFolder.parentId;
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
                    if(bookmarkFolders.has(folderId)) {
                        bookmarkFolders.delete(folderId);
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

async function saveGoods(goods, type) {
    if(goods.image) {
        const buffer = await goods.image.arrayBuffer();
        goods.image = new Blob ([buffer], {
            type: goods.image.type
        });
    }
    if(isLoading) {
        return Promise.reject(new Error("loading error"));
    }
    if(goods.id < 1) {
        return Promise.reject(new Error("Invalid goods ID"));
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
        } else if(type === "edit") {
            transaction = db.transaction("goods", "readwrite");
            const store = transaction.objectStore("goods");
            if(Object.hasOwn(goods, "id")) {
                editingGoods = goods;
            } else {
                editingGoods = {
                    ...goods,
                    id: currentGoodsId
                };
            }
            store.put(editingGoods);
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
                const folderIds = editingGoods?.folderId;
                for(const folderId of folderIds) {
                    if(loadedFolders.has(folderId)) {
                        const goodsIndex = loadedFolders.get(folderId).goods.findIndex((g) => g.id === editingGoods.id);
                        if(goodsIndex !== -1) {
                            loadedFolders.get(folderId).goods[goodsIndex] = editingGoods;
                        } else {
                            loadedFolders.get(folderId).goods.push(editingGoods);
                        }
                    }
                }
                const deleteIds = editingGoods?.folderId?.filter((g) => !folderIds.includes(g)) ?? [];
                for(const folderId of deleteIds) {
                    if(loadedFolders.has(folderId)) {
                        const goodsIndex = loadedFolders.get(folderId).goods.findIndex((g) => g.id === editingGoods.id);
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

async function toggleFolderBookmark(id, button) {
    if(button.tabIndex == -1) {
        return;
    }
    button.blur();
    button.tabIndex = -1;
    button.classList.add("loading");
    const pairButtonEle = document.getElementById(`folder-favorite-button-${id}`);
    pairButtonEle.tabIndex = -1;
    pairButtonEle.classList.add("loading");
    try {
        const isBookmarked = !button.classList.contains("checked");
        const targetFolder = await getCurrentFolder(id);
        targetFolder.bookmark = isBookmarked ? 1 : 0;
        await saveFolder(targetFolder, "edit");
        button.classList.toggle("checked");
        if(!bookmarkFolders.has(id) && isBookmarked) {
            bookmarkFolders.set(id, targetFolder);
        } else if(bookmarkFolders.has(id) && !isBookmarked) {
            bookmarkFolders.delete(id);
        }
    } catch(error) {
        showBanner("エラーが発生しました。");
        console.error(error);
    }
    if(isAnimationReduced) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    button.tabIndex = 0;
    button.classList.remove("loading");
    pairButtonEle.tabIndex = 0;
    pairButtonEle.classList.remove("loading");
}

async function toggleFolderFavorite(id, button) {
    if(button.tabIndex == -1) {
        return;
    }
    button.blur();
    button.tabIndex = -1;
    button.classList.add("loading");
    const pairButtonEle = document.getElementById(`folder-bookmark-button-${id}`);
    pairButtonEle.tabIndex = -1;
    pairButtonEle.classList.add("loading");
    try {
        const targetFolder = await getCurrentFolder(id);
        targetFolder.favorite = !button.classList.contains("checked");
        await saveFolder(targetFolder, "edit");
        button.classList.toggle("checked");
    } catch(error) {
        showBanner("エラーが発生しました。");
        console.error(error);
    }
    if(isAnimationReduced) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    button.tabIndex = 0;
    button.classList.remove("loading");
    pairButtonEle.tabIndex = 0;
    pairButtonEle.classList.remove("loading");
}

async function toggleGoodsFavorite(id, button) {
    if(button.tabIndex == -1) {
        return;
    }
    button.blur();
    button.tabIndex = -1;
    button.classList.add("loading");
    try {
        const targetGoods = await getCurrentGoods(id);
        targetGoods.favorite = !button.classList.contains("checked");
        await saveGoods(targetGoods, "edit");
        button.classList.toggle("checked");
    } catch(error) {
        showBanner("エラーが発生しました。");
        console.error(error);
    }
    if(isAnimationReduced) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    button.tabIndex = 0;
    button.classList.remove("loading");
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

function getBookmarkFolders() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("folders", "readonly");
        const store = transaction.objectStore("folders");
        const index = store.index("bookmark");
        const request = index.getAll(1);
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

async function hideLoadingMark(result) {
    if(isAnimationReduced) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    isLoading = false;
    const itemLoadingMessageEle = document.getElementById("item-loading-message");
    itemLoadingMessageEle.style.display = "none";
    if(result === "success") {
        const folderGoodsGroupEle = document.getElementById("folder-goods-group");
        folderGoodsGroupEle.style.removeProperty("display");
    }
}

async function openFolder(id, type, mode = null, item = null) {
    showLoadingMark();
    try {
        if(type === "open") {
            pageChangeHistory.push(currentFolderId);
        }
        currentFolderId = id;
        currentFolder = await getCurrentFolder(id);
        if(!loadedFolders.has(id)) {
            folders = await getChildFolders(id);
            goods = await getGoods(id);
            loadedFolders.set(id, {
                folders: folders,
                goods: goods
            });
        } else {
            const lFolders = loadedFolders.get(id);
            folders = lFolders.folders;
            goods = lFolders.goods;
        }
        goods = [...goods.filter((goods) => goods.favorite), ...goods.filter((goods) => !goods.favorite)];
        await applyCollection(folders, bookmarkFolders, goods, currentFolder, currentGoodsId, settings, mode, item, CATEGORY_LIST, {
            getSymbolSvg: getSymbolSvg,
            openFolder: openFolder,
            openGoods: openGoods,
            getContrastColor: getContrastColor,
            getImagePosition: getImagePosition,
            autoScroll: autoScroll,
            toggleFolderBookmark: toggleFolderBookmark,
            toggleFolderFavorite: toggleFolderFavorite,
            toggleGoodsFavorite: toggleGoodsFavorite
        });
        const descriptionEle = document.getElementById("folder-description");
        if(descriptionEle) {
            descriptionEle.textContent = id === 0 ? "" : currentFolder.description ?? "";
        }
        if(type !== "edit") {
            await applyPageHistoryButtons(pageChangeHistory, id, {
                getCurrentFolder: getCurrentFolder,
                pageBack: pageBack
            });
        }
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
            document.documentElement.style.setProperty("--folder-border-color", textColor);
            document.documentElement.style.setProperty("--folder-overview-color", overviewColor);
            document.documentElement.style.setProperty("--folder-overview-background-color", overviewBackgroundColor);
        } else {
            document.documentElement.style.removeProperty("--folder-color");
            document.documentElement.style.removeProperty("--folder-text-color");
            document.documentElement.style.removeProperty("--folder-border-color");
            document.documentElement.style.removeProperty("--folder-overview-color");
            document.documentElement.style.removeProperty("--folder-overview-background-color");
        }
        if(!["init", "toggle-hide-image", "reload", "update"].includes(type)) {
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
            img.alt = "";
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
        deleteGoodsButton.classList.add("delete-button");
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
            isShowGoods = false;
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
        isShowGoods = true;
        showPopup(popupContent);
    } catch (error) {
        console.error(`Error opening goods: ${error}`);
        showBanner("グッズの読み込みに失敗しました。");
    } finally {
        hideLoadingMark("success");
    }
}

function swipeGoods(pos) {
    if(swipeStartPos === null || swipeStartPos === undefined || (goods?.length ?? 0) <= 1) {
        return;
    }
    const diff = pos - swipeStartPos;
    if(Math.abs(diff) > 70 && isShowGoods && (disabledElesList.banner?.length ?? 0) === 0) {
        const currentId = goods.findIndex((g) => g.id === currentGoodsId);
        let newId = 0;
        if(diff > 0) {
            if(currentId - 1 >= 0) {
                newId = goods[currentId - 1].id;
            } else {
                newId = goods[goods.length - 1].id
            }
        } else {
            if(currentId + 1 < goods.length) {
                newId = goods[currentId + 1].id;
            } else {
                newId = goods[0].id
            }
        }
        openGoods(newId);
    }
    swipeStartPos = null;
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
    await openFolder(openId, "back");
}

async function deleteAfterCalculation(a, b, input, target) {
    const value = parseInt(input?.value);
    const answer = a * b;
    if(!Number.isFinite(value) || answer !== value) {
        showBanner("不正解のため削除できませんでした。");
        return false;
    } else {
        try {
            if(target === "folder") {
                await saveFolder(currentFolder, "delete");
            } else if(target === "goods") {
                await saveGoods(currentGoods, "delete");
            } else if(target === "penlight") {
                deletePenlight();
            } else {
                showBanner("エラーが発生しました。");
                return false;
            }
        } catch(error) {
            console.error(`Error deleting goods: ${error}`);
            showBanner("削除に失敗しました。");
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

function showDetails(button, type = "auto") {
    const target = button.dataset.target;
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
        const targetArrowEle = document.getElementById(`${target}-arrow`);
        if(targetArrowEle) {
            if(targetEle.classList.contains("open")) {
                targetArrowEle.ariaLabel = "開いている折りたたみ要素";
            } else {
                targetArrowEle.ariaLabel = "閉じている折りたたみ要素";
            }
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
        isShowGoods = false;
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
    const canFocusEles = Array.from(document.querySelectorAll("a:not([tabindex='-1']), span[role='button']:not([tabindex='-1'])"));
    if (!noFocusElesList[type]) {
        noFocusElesList[type] = [];
    }
    noFocusElesList[type].push(canFocusEles);
    canFocusEles.forEach((f) => {
        f.setAttribute("tabindex", "-1");
    });
    const focusedEle = document.activeElement;
    focusedEle.blur();
    const contentEle = document.getElementById("content");
    if(!contentEle?.dataset?.openedBy) {
        contentEle.dataset.openedBy = type;
        contentEle.ariaHidden = true;
    }
    const blurEle = document.getElementById("popup");
    if(!blurEle?.dataset?.openedBy && (disabledElesList.popup?.length ?? 0) > 0 && type !== "popup") {
        blurEle.dataset.openedBy = type;
        blurEle.ariaHidden = true;
    }
    const detailsMenuGroupEle = document.getElementById("details-menu-group");
    if(!detailsMenuGroupEle?.dataset?.openedBy && type !== "details-menu") {
        detailsMenuGroupEle.dataset.openedBy = type;
        detailsMenuGroupEle.ariaHidden = true;
    }
    document.body.style.overflow = "hidden";
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
            f.setAttribute("tabindex", "0");
        });
    }
    const contentEle = document.getElementById("content");
    if(contentEle?.dataset?.openedBy === type) {
        delete contentEle.dataset.openedBy;
        contentEle.removeAttribute("aria-hidden");
    }
    const blurEle = document.getElementById("popup");
    if(blurEle?.dataset?.openedBy === type) {
        delete blurEle.dataset.openedBy;
        blurEle.removeAttribute("aria-hidden");
    }
    const detailsMenuGroupEle = document.getElementById("details-menu-group");
    if(detailsMenuGroupEle?.dataset?.openedBy === type) {
        delete detailsMenuGroupEle.dataset.openedBy;
        detailsMenuGroupEle.removeAttribute("aria-hidden");
    }
    if(Object.values(disabledElesList).every((v) => v.length === 0)) {
        document.body.style.removeProperty("overflow");
    }
}

function autoScroll(target, behavior = "smooth") {
    if(typeof target === "string") {
        const targetEle = document.getElementById(target);
        if(targetEle) {
            const y = targetEle.getBoundingClientRect().y + window.pageYOffset - 50;
            window.scrollTo({
                top: y,
                behavior: (isAnimationReduced ? "auto" : behavior)
            });
        }
    } else if(typeof target === "number") {
        window.scrollTo({
            top: target,
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
    const now = Date.now();
    if(animationStartDate === null || animationStartDate === undefined) {
        animationStartDate = now;
    }
    animationElapsedInterval += now - animationStartDate;
    animationStartDate = now;
    const interval = customPenlightAnimationInterval ?? PENLIGHT_ANIMATION_INTERVAL;
    if(animationElapsedInterval >= interval) {
        const penlightList = customPenlightColorList ?? PENLIGHT_COLOR_LIST;
        penlightColorId = (penlightColorId + 1) % penlightList.length;
        animationElapsedInterval = 0;
        const penlightColorSvgEles = document.querySelectorAll(".penlight-color-svg:not(.editing)");
        const color = penlightList[penlightColorId];
        penlightColorSvgEles.forEach((p) => {
            if(typeof color === "string") {
                p.style.fill = color;
            } else if(p.classList.contains("bottom")) {
                p.style.fill = color.bottom ?? "#e5a";
            } else {
                p.style.fill = color.top ?? "#e5a";
            }
        });
    }
    if(!isAnimationReduced) {
        requestAnimationFrame(penlightAnimation);
    }
}

function changePenlightAnimation() {
    const penlightSelectEle = document.getElementById("penlight-select");
    const id = penlightSelectEle.value;
    const deletePenlightButtonEle = document.getElementById("delete-penlight-button");
    const editPenlightButtonEle = document.getElementById("edit-penlight-button");
    if(id === "") {
        customPenlightColorList = null;
        customPenlightAnimationInterval = null;
        deletePenlightButtonEle.disabled = true;
        deletePenlightButtonEle.classList.add("disabled");
        editPenlightButtonEle.disabled = true;
        editPenlightButtonEle.classList.add("disabled");
        if(settings.penlight) {
            settings.penlight.usePenlightId = null;
        }
    } else {
        const penlight = settings?.penlight?.list?.find((p) => p.id === Number(id));
        customPenlightColorList = penlight?.color;
        customPenlightAnimationInterval = penlight?.interval;
        deletePenlightButtonEle.disabled = false;
        deletePenlightButtonEle.classList.remove("disabled");
        editPenlightButtonEle.disabled = false;
        editPenlightButtonEle.classList.remove("disabled");
        if(settings.penlight) {
            settings.penlight.usePenlightId = Number(id);
        }
    }
    saveSettings();
    const penlightColorList = customPenlightColorList ?? PENLIGHT_COLOR_LIST;
    penlightColorId = penlightColorList.length - 1;
    animationElapsedInterval = 10000;
}

async function deletePenlight() {
    const penlightSelectEle = document.getElementById("penlight-select");
    if(penlightSelectEle.value === "") {
        return;
    }
    const penlightId = Number(penlightSelectEle.value);
    try {
        const index = settings?.penlight?.list?.findIndex(p => p.id === penlightId);
        if(index !== -1) {
            settings.penlight.list.splice(index, 1);
            customPenlightColorList = null;
            customPenlightAnimationInterval = null;
            penlightColorId = PENLIGHT_COLOR_LIST.length - 1;
            animationElapsedInterval = 10000;
            const deletePenlightButtonEle = document.getElementById("delete-penlight-button");
            deletePenlightButtonEle.disabled = true;
            deletePenlightButtonEle.classList.add("disabled");
            const editPenlightButtonEle = document.getElementById("edit-penlight-button");
            editPenlightButtonEle.disabled = true;
            editPenlightButtonEle.classList.add("disabled");
            await saveSettings();
            applyCustomPenlight(settings);
        }
    } catch(error) {
        console.error("Error deleting penlight:", error);
    }
}

function toggleAnimationReduction(reduced) {
    isAnimationReduced = reduced;
    const animationReduceDiscriptionEles = document.querySelectorAll(".animation-reduce-description");
    const noFolderColorCheckboxEle = document.getElementById("no-folder-color");
    const penlightSelectEle = document.getElementById("penlight-select");
    const deletePenlightButtonEle = document.getElementById("delete-penlight-button");
    const editPenlightButtonEle = document.getElementById("edit-penlight-button");
    const penlightSettingsButtonEle = document.getElementById("penlight-settings-button");
    if(!reduced) {
        animationReduceDiscriptionEles.forEach((d) => {
            d.style.display = "none";
        });
        noFolderColorCheckboxEle.checked = settings?.checkbox?.["no-folder-color"] ?? false;
        if((disabledElesList.popup?.length ?? 0) === 0 && (disabledElesList.banner?.length ?? 0) === 0) {
            noFolderColorCheckboxEle.disabled = false;
            if(penlightSelectEle.value !== "") {
                deletePenlightButtonEle.disabled = false;
                editPenlightButtonEle.disabled = false;
            }
            if(settings?.penlight?.list?.length > 0) {
                penlightSelectEle.disabled = false;
            }
            penlightSettingsButtonEle.disabled = false;
        }
        noFolderColorCheckboxEle.classList.remove("disabled");
        penlightSelectEle.classList.remove("disabled");
        deletePenlightButtonEle.classList.remove("disabled");
        editPenlightButtonEle.classList.remove("disabled");
        penlightSettingsButtonEle.classList.remove("disabled");
        penlightAnimation();
    } else {
        animationReduceDiscriptionEles.forEach((d) => {
            d.style.display = null;
        });
        noFolderColorCheckboxEle.checked = true;
        noFolderColorCheckboxEle.disabled = true;
        noFolderColorCheckboxEle.classList.add("disabled");
        penlightSelectEle.disabled = true;
        penlightSelectEle.classList.add("disabled");
        deletePenlightButtonEle.disabled = true;
        deletePenlightButtonEle.classList.add("disabled");
        editPenlightButtonEle.disabled = true;
        editPenlightButtonEle.classList.add("disabled");
        penlightSettingsButtonEle.disabled = true;
        penlightSettingsButtonEle.classList.add("disabled");
    }
}

window.addEventListener("keydown", (e) => {
    if(e.key === "Enter" || e.key === " ") {
        const activeEle = document.activeElement;
        if(!activeEle) {
            return;
        }
        const id = Number(activeEle?.dataset?.id);
        if(!Number.isFinite(id)) {
            return;
        }
        if(activeEle?.classList.contains("favorite-button")) {
            const type = activeEle?.dataset?.type;
            if(type === "folder") {
                toggleFolderFavorite(id, activeEle);
            } else if(type === "goods") {
                toggleGoodsFavorite(id, activeEle);
            }
        } else if(activeEle?.classList.contains("bookmark-button")) {
            toggleFolderBookmark(id, activeEle);
        }
    }
});

window.addEventListener("pointerdown", (e) => {
    if(e.pointerType === "touch") {
        swipeStartPos = e.clientX;
    } else {
        swipeStartPos = null;
    }
});

window.addEventListener("pointerup", (e) => {
    const selectedText = window.getSelection().toString();
    if(e.pointerType === "touch" && selectedText.length === 0) {
        swipeGoods(e.clientX);
    }
});

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
            showDetails(d);
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
            showDetails(j, "close");
        });
    });
    const settingsCheckboxEles = document.querySelectorAll(".settings-checkbox");
    settingsCheckboxEles.forEach((s) => {
        s.addEventListener("change", () => {
            changeSettingsCheckbox(s);
        });
    });
    const penlightSelectEle = document.getElementById("penlight-select");
    penlightSelectEle.addEventListener("change", () => {
        changePenlightAnimation();
    });
    const deletePenlightButtonEle = document.getElementById("delete-penlight-button");
    deletePenlightButtonEle.addEventListener("click", () => {
        const penlightSelectEle = document.getElementById("penlight-select");
        if(penlightSelectEle.value === "") {
            showBanner("カスタムしたペンライトを選択してください。");
            return;
        }
        const penlightName = settings?.penlight?.list?.find(p => p.id === Number(penlightSelectEle.value))?.name;
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
            messageLabel.append(`ペンライト「${penlightName}」を削除するには計算問題を解いてください: ${a} × ${b} = `, input);
            showBanner(messageLabel, [{
                text: "回答する",
                fn: deleteAfterCalculation,
                arg: [a, b, input, "penlight"]
            }, {
                text: "キャンセル"
            }]);
        } else {
            showBanner(`ペンライト「${penlightName}」を削除しますか？`, [{
                text: "削除",
                fn: deletePenlight
            }, {
                text: "キャンセル"
            }]);
        }
    });
    const editPenlightButtonEle = document.getElementById("edit-penlight-button");
    editPenlightButtonEle.addEventListener("click", () => {
        const penlightSelectEle = document.getElementById("penlight-select");
        if(penlightSelectEle.value === "") {
            showBanner("カスタムしたペンライトを選択してください。");
            return;
        }
        addEditPenlightPopup(settings, "edit", Number(penlightSelectEle.value), {
            showPopup: showPopup,
            showBanner: showBanner,
            saveSettings: saveSettings,
            applyCustomPenlight: applyCustomPenlight,
            changePenlightAnimation: changePenlightAnimation
        });
    });
    const penlightSettingsButtonEle = document.getElementById("penlight-settings-button");
    penlightSettingsButtonEle.addEventListener("click", () => {
        addEditPenlightPopup(settings, "add", null, {
            showPopup: showPopup,
            showBanner: showBanner,
            saveSettings: saveSettings,
            applyCustomPenlight: applyCustomPenlight,
            changePenlightAnimation: changePenlightAnimation
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