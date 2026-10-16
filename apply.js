let isOpenDisabled = false;

export function applySettings(settings, isAnimationReduced, fn) {
    const displayModeSelectEle = document.getElementById("display-mode-select");
    if(displayModeSelectEle) {
        const displayMode = settings.displayMode ?? "list";
        displayModeSelectEle.value = displayMode;
        fn.changeDisplayMode(displayMode);
    }
    const selectedAppearanceModeEle = document.getElementById(settings.appearance);
    if(selectedAppearanceModeEle && !isAnimationReduced) {
        selectedAppearanceModeEle.checked = true;
    }
    const checkbox = settings.checkbox;
    if(checkbox) {
        Object.entries(checkbox).forEach(([key, value]) => {
            const checkboxEle = document.getElementById(key);
            if(checkboxEle && !checkboxEle.classList.contains("disabled")) {
                checkboxEle.checked = value;
                fn.changeSettingsCheckbox(checkboxEle);
            }
        });
    }
}

export async function applyCollection(folders, bookmarkFolders, goods, currentFolder, currentGoodsId, settings, mode, item, CATEGORY_LIST, fn) {
    const folderResult = applyFolder(folders, bookmarkFolders, settings, {
        getSymbolSvg: fn.getSymbolSvg,
        openFolder: fn.openFolder,
        getContrastColor: fn.getContrastColor,
        getImagePosition: fn.getImagePosition,
        toggleFolderBookmark: fn.toggleFolderBookmark,
        toggleFolderFavorite: fn.toggleFolderFavorite
    });
    const goodsResult = applyGoods(goods, currentFolder, settings, CATEGORY_LIST, {
        getSymbolSvg: fn.getSymbolSvg,
        openGoods: fn.openGoods,
        getContrastColor: fn.getContrastColor,
        getImagePosition: fn.getImagePosition,
        toggleGoodsFavorite: fn.toggleGoodsFavorite
    });
    const noItemsMessageEle = document.getElementById("no-items-message");
    if(!folderResult && !goodsResult) {
        noItemsMessageEle.style.display = "block";
    } else {
        noItemsMessageEle.style.removeProperty("display");
    }
    if(mode) {
        targetScroll(mode, item, (item === "goods" ? (mode === "edit" ? currentGoodsId : settings?.nextGoodsId) : settings?.nextFolderId), {
            autoScroll: fn.autoScroll
        });
    }
}

function waitForDisplay(element) {
    return new Promise((resolve) => {
        const callback = (mutationsList, observer) => {
            for(const mutation of mutationsList) {
                if(mutation.type === "attributes" && mutation.attributeName === "style") {
                    const currentDisplay = window.getComputedStyle(element).display;
                    if(currentDisplay !== "none") {
                        observer.disconnect();
                        resolve();
                    }
                }
            }
        };
        const observer = new MutationObserver(callback);
        observer.observe(element, {
            attributes: true,
            attributeFilter: ["style"]
        });
    });
}

async function targetScroll(mode, item, id, fn) {
    const folderGoodsGroupEle = document.getElementById("folder-goods-group");
    await waitForDisplay(folderGoodsGroupEle);
    //await new Promise(resolve => setTimeout(resolve, 100));//elementが反映されるまで待つ
    console.log(id);
    switch(item) {
        case "folder":
            if(mode !== "edit") {
                fn.autoScroll(`folder-button-${id}`);
            }
            break;
        
        case "goods":
            fn.autoScroll(`goods-button-${id}`);
            break;

        default:
            break;
    }
}

function applyFolder(folders, bookmarkFolders, settings, fn) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const folderListEle = document.getElementById("folder-list");
    const favoriteFolderListEle = document.getElementById("favorite-folder-list");
    const bookmarkFolderListEle = document.getElementById("bookmark-folder-list");
    folderListEle.innerHTML = "";
    favoriteFolderListEle.innerHTML = "";
    bookmarkFolderListEle.innerHTML = "";
    const allFolders = [...folders, ...bookmarkFolders.values()];
    const bookmarkFolderBoxEle = document.getElementById("bookmark-folder-box");
    if(bookmarkFolders.size === 0) {
        bookmarkFolderBoxEle.style.display = "none";
    } else {
        bookmarkFolderBoxEle.style.removeProperty("display");
    }
    if((allFolders ?? []).length === 0) {
        return false;
    }
    const isImageHidden = settings?.checkbox?.["privacy-protection"];
    allFolders.forEach((f, i) => {
        if(i < folders.length && (f.bookmark ?? false)) {
            return;
        }
        const name = (f.name ?? "") === "" ? "無題" : f.name;
        const image = f.image;
        const box = document.createElement("div");
        const button = document.createElement("button");
        const id = f.id;
        button.id = `folder-button-${id}`;
        button.classList.add("folder-button");
        button.title = name;
        const actionButtonGroup = document.createElement("span");
        actionButtonGroup.classList.add("action-button-group");
        const favoriteButton = document.createElement("span");
        favoriteButton.id = `folder-favorite-button-${id}`;
        favoriteButton.classList.add("favorite-button");
        favoriteButton.dataset.id = id;
        favoriteButton.dataset.type = "folder";
        favoriteButton.tabIndex = 0;
        favoriteButton.ariaLabel = "お気に入りボタン";
        favoriteButton.role = "button";
        if(f.favorite) {
            favoriteButton.classList.add("checked");
        }
        favoriteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            fn.toggleFolderFavorite(id, favoriteButton);
        });
        favoriteButton.addEventListener("focus", () => {
            isOpenDisabled = true;
        });
        favoriteButton.addEventListener("blur", () => {
            isOpenDisabled = false;
        });
        const favoriteSvg = document.createElementNS(SVG_NS, "svg");
        favoriteSvg.classList.add("favorite-svg");
        favoriteSvg.setAttribute("viewBox", "0 0 100 100");
        const favoriteSvgG = document.createElementNS(SVG_NS, "g");
        favoriteSvgG.classList.add("favorite-mark-svg");
        favoriteSvgG.setAttribute("fill", "currentColor");
        favoriteSvgG.setAttribute("stroke", "currentColor");
        favoriteSvgG.setAttribute("stroke-width", "5");
        const favoriteSvgPath = document.createElementNS(SVG_NS, "path");
        favoriteSvgPath.setAttribute("d", "M 50 80 L 25 55 A 1 1 0 0 1 50 30 A 1 1 0 0 1 75 55 Z");
        favoriteSvgG.append(favoriteSvgPath);
        favoriteSvg.append(favoriteSvgG);
        const favoriteLoadingSvg = document.createElementNS(SVG_NS, "svg");
        favoriteLoadingSvg.classList.add("loading-mark");
        favoriteLoadingSvg.setAttribute("viewBox", "0 0 100 100");
        const favoriteLoadingSvgCircle = document.createElementNS(SVG_NS, "circle");
        favoriteLoadingSvgCircle.setAttribute("cx", "50");
        favoriteLoadingSvgCircle.setAttribute("cy", "50");
        favoriteLoadingSvgCircle.setAttribute("r", "40");
        favoriteLoadingSvgCircle.setAttribute("fill", "none");
        favoriteLoadingSvgCircle.setAttribute("stroke", "url(#loading-gradient)");
        favoriteLoadingSvgCircle.setAttribute("stroke-width", "12");
        favoriteLoadingSvgCircle.setAttribute("stroke-linecap", "round");
        favoriteLoadingSvgCircle.setAttribute("stroke-dasharray", "170");
        favoriteLoadingSvgCircle.setAttribute("stroke-dashoffset", "0");
        favoriteLoadingSvg.append(favoriteLoadingSvgCircle);
        favoriteButton.append(favoriteSvg, favoriteLoadingSvg);
        const bookmarkButton = document.createElement("span");
        bookmarkButton.id = `folder-bookmark-button-${id}`;
        bookmarkButton.classList.add("bookmark-button");
        bookmarkButton.dataset.id = id;
        bookmarkButton.tabIndex = 0;
        bookmarkButton.ariaLabel = "ブックマークボタン";
        bookmarkButton.role = "button";
        if(f.bookmark === 1) {
            bookmarkButton.classList.add("checked");
        }
        bookmarkButton.addEventListener("click", (event) => {
            event.stopPropagation();
            fn.toggleFolderBookmark(id, bookmarkButton);
        });
        bookmarkButton.addEventListener("focus", () => {
            isOpenDisabled = true;
        });
        bookmarkButton.addEventListener("blur", () => {
            isOpenDisabled = false;
        });
        const bookmarkSvg = document.createElementNS(SVG_NS, "svg");
        bookmarkSvg.classList.add("bookmark-svg");
        bookmarkSvg.setAttribute("viewBox", "0 0 100 100");
        const bookmarkSvgG = document.createElementNS(SVG_NS, "g");
        bookmarkSvgG.classList.add("bookmark-mark-svg");
        bookmarkSvgG.setAttribute("fill", "currentColor");
        bookmarkSvgG.setAttribute("stroke", "currentColor");
        bookmarkSvgG.setAttribute("stroke-width", "5");
        const bookmarkSvgPath = document.createElementNS(SVG_NS, "path");
        bookmarkSvgPath.setAttribute("d", "M 30 25 Q 30 20, 35 20 H 65 Q 70 20, 70 25 V 80 L 50 65 L 30 80 Z");
        bookmarkSvgG.append(bookmarkSvgPath);
        bookmarkSvg.append(bookmarkSvgG);
        const bookmarkLoadingSvg = document.createElementNS(SVG_NS, "svg");
        bookmarkLoadingSvg.classList.add("loading-mark");
        bookmarkLoadingSvg.setAttribute("viewBox", "0 0 100 100");
        const bookmarkLoadingSvgCircle = document.createElementNS(SVG_NS, "circle");
        bookmarkLoadingSvgCircle.setAttribute("cx", "50");
        bookmarkLoadingSvgCircle.setAttribute("cy", "50");
        bookmarkLoadingSvgCircle.setAttribute("r", "40");
        bookmarkLoadingSvgCircle.setAttribute("fill", "none");
        bookmarkLoadingSvgCircle.setAttribute("stroke", "url(#loading-gradient)");
        bookmarkLoadingSvgCircle.setAttribute("stroke-width", "12");
        bookmarkLoadingSvgCircle.setAttribute("stroke-linecap", "round");
        bookmarkLoadingSvgCircle.setAttribute("stroke-dasharray", "170");
        bookmarkLoadingSvgCircle.setAttribute("stroke-dashoffset", "0");
        bookmarkLoadingSvg.append(bookmarkLoadingSvgCircle);
        bookmarkButton.append(bookmarkSvg, bookmarkLoadingSvg);
        actionButtonGroup.append(favoriteButton, bookmarkButton);
        button.append(actionButtonGroup);
        if(image && !isImageHidden) {
            try {
                const url = URL.createObjectURL(image);
                const img = document.createElement("img");
                img.classList.add("folder-image");
                img.alt = "";
                img.style.objectPosition = fn.getImagePosition(f.imagePosition);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                }
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                }
                img.src = url;
                button.append(img);
            } catch (error) {
                console.error("Error creating object URL for folder image:", error);
                const symbolSvg = fn.getSymbolSvg("folder", "folder-symbol-svg");
                button.append(symbolSvg);
            }
        } else {
            const symbolSvg = fn.getSymbolSvg("folder", "folder-symbol-svg");
            button.append(symbolSvg);
        }
        const overviewArrowGroup = document.createElement("div");
        overviewArrowGroup.classList.add("overview-arrow-group");
        const overviewGroup = document.createElement("div");
        overviewGroup.classList.add("overview-group");
        const title = document.createElement("div");
        title.textContent = name;
        title.classList.add("folder-title");
        overviewGroup.append(title);
        const description = document.createElement("div");
        const descriptionText = (f.description ?? "") === "" ? "説明はありません。" : f.description;
        description.classList.add("overview");
        description.textContent = descriptionText;
        overviewGroup.append(description);
        const kinds = document.createElement("div");
        kinds.classList.add("overview");
        kinds.textContent = "アルバム";
        overviewGroup.append(kinds);
        overviewArrowGroup.append(overviewGroup);
        let color = f.color;
        const colorUse = f.colorUse ?? true;
        if(!colorUse) {
            color = null;
        }
        const textColor = fn.getContrastColor(color, "text");
        const overviewColor = fn.getContrastColor(color, "overview");
        button.style.setProperty("--folder-text-color", textColor);
        button.style.setProperty("--folder-overview-color", overviewColor);
        if(color && colorUse) {
            button.style.setProperty("--folder-color", color);
        }
        const arrowSvg = document.createElementNS(SVG_NS, "svg");
        arrowSvg.classList.add("folder-arrow");
        arrowSvg.setAttribute("viewBox", "0 0 30 100");
        arrowSvg.setAttribute("width", "30");
        arrowSvg.setAttribute("height", "100");
        const arrowSvgG = document.createElementNS(SVG_NS, "g");
        arrowSvgG.classList.add("text-svg");
        arrowSvgG.setAttribute("fill", "none");
        arrowSvgG.setAttribute("stroke", "currentColor");
        arrowSvgG.setAttribute("stroke-width", "2");
        const arrowSvgPath = document.createElementNS(SVG_NS, "path");
        arrowSvgPath.setAttribute("d", "M 0 20 L 20 50 L 0 80");
        arrowSvgG.append(arrowSvgPath);
        arrowSvg.append(arrowSvgG);
        overviewArrowGroup.append(arrowSvg);
        button.append(overviewArrowGroup);
        button.ariaLabel = `アルバムを開く、${name}、${descriptionText}`;
        button.addEventListener("click", async () => {
            if(!isOpenDisabled) {
                await fn.openFolder(id, "open");
            }
        });
        box.append(button);
        if(f.bookmark) {
            bookmarkFolderListEle.append(box);
        } else if(f.favorite) {
            favoriteFolderListEle.append(box);
        } else {
            folderListEle.append(box);
        }
    });
    return true;
}

function applyGoods(goods, currentFolder, settings, CATEGORY_LIST, fn) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const goodsListEle = document.getElementById("goods-list");
    const favoriteGoodsListEle = document.getElementById("favorite-goods-list");
    goodsListEle.innerHTML = "";
    favoriteGoodsListEle.innerHTML = "";
    if((goods ?? []).length === 0) {
        return false;
    }
    let color = currentFolder?.color;
    const colorUse = currentFolder?.colorUse ?? true;
    const isImageHidden = settings?.checkbox?.["privacy-protection"];
    goods.forEach((g) => {
        const name = (g.name ?? "") === "" ? "無題" : g.name;
        const image = g.image;
        const category = g.category;
        const box = document.createElement("div");
        const button = document.createElement("button");
        button.id = `goods-button-${g.id}`;
        button.classList.add("goods-button");
        button.title = name;
        const actionButtonGroup = document.createElement("span");
        actionButtonGroup.classList.add("action-button-group");
        const favoriteButton = document.createElement("span");
        favoriteButton.classList.add("favorite-button");
        favoriteButton.dataset.id = g.id;
        favoriteButton.dataset.type = "goods";
        favoriteButton.tabIndex = 0;
        favoriteButton.ariaLabel = "お気に入りボタン";
        favoriteButton.role = "button";
        if(g.favorite) {
            favoriteButton.classList.add("checked");
        }
        favoriteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            fn.toggleGoodsFavorite(g.id, favoriteButton);
        });
        favoriteButton.addEventListener("focus", () => {
            isOpenDisabled = true;
        });
        favoriteButton.addEventListener("blur", () => {
            isOpenDisabled = false;
        });
        const favoriteSvg = document.createElementNS(SVG_NS, "svg");
        favoriteSvg.classList.add("favorite-svg");
        favoriteSvg.setAttribute("viewBox", "0 0 100 100");
        const favoriteSvgG = document.createElementNS(SVG_NS, "g");
        favoriteSvgG.classList.add("favorite-mark-svg");
        favoriteSvgG.setAttribute("fill", "currentColor");
        favoriteSvgG.setAttribute("stroke", "currentColor");
        favoriteSvgG.setAttribute("stroke-width", "5");
        const favoriteSvgPath = document.createElementNS(SVG_NS, "path");
        favoriteSvgPath.setAttribute("d", "M 50 80 L 25 55 A 1 1 0 0 1 50 30 A 1 1 0 0 1 75 55 Z");
        favoriteSvgG.append(favoriteSvgPath);
        favoriteSvg.append(favoriteSvgG);
        const favoriteLoadingSvg = document.createElementNS(SVG_NS, "svg");
        favoriteLoadingSvg.classList.add("loading-mark");
        favoriteLoadingSvg.setAttribute("viewBox", "0 0 100 100");
        const favoriteLoadingSvgCircle = document.createElementNS(SVG_NS, "circle");
        favoriteLoadingSvgCircle.setAttribute("cx", "50");
        favoriteLoadingSvgCircle.setAttribute("cy", "50");
        favoriteLoadingSvgCircle.setAttribute("r", "40");
        favoriteLoadingSvgCircle.setAttribute("fill", "none");
        favoriteLoadingSvgCircle.setAttribute("stroke", "url(#loading-gradient)");
        favoriteLoadingSvgCircle.setAttribute("stroke-width", "12");
        favoriteLoadingSvgCircle.setAttribute("stroke-linecap", "round");
        favoriteLoadingSvgCircle.setAttribute("stroke-dasharray", "170");
        favoriteLoadingSvgCircle.setAttribute("stroke-dashoffset", "0");
        favoriteLoadingSvg.append(favoriteLoadingSvgCircle);
        favoriteButton.append(favoriteSvg, favoriteLoadingSvg);
        actionButtonGroup.append(favoriteButton);
        button.append(actionButtonGroup);
        if(image && !isImageHidden) {
            try {
                const url = URL.createObjectURL(image);
                const img = document.createElement("img");
                img.classList.add("goods-image");
                img.alt = "";
                img.style.objectPosition = fn.getImagePosition(g.imagePosition);
                img.onload = () => {
                    URL.revokeObjectURL(url);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                }
                img.src = url;
                button.append(img);
            } catch(e) {
                const symbolSvg = fn.getSymbolSvg(category, "goods-symbol-svg");
                button.append(symbolSvg);
            }
        } else {
            const symbolSvg = fn.getSymbolSvg(category, "goods-symbol-svg");
            button.append(symbolSvg);
        }
        const title = document.createElement("div");
        title.textContent = name;
        title.classList.add("goods-title");
        const overviewGroup = document.createElement("div");
        overviewGroup.classList.add("overview-group");
        const descriptionText = (g.description ?? "") === "" ? "説明はありません。" : g.description;
        const description = document.createElement("div");
        description.classList.add("overview");
        description.textContent = descriptionText;
        overviewGroup.append(title);
        overviewGroup.append(description);
        const categoryText = `カテゴリ: ${CATEGORY_LIST[category] ?? "不明"}`;
        const categoryOverview = document.createElement("div");
        categoryOverview.classList.add("overview");
        categoryOverview.textContent = categoryText;
        overviewGroup.append(categoryOverview);
        button.append(overviewGroup);
        const count = g.count;
        const countOverview = document.createElement("div");
        countOverview.classList.add("overview");
        countOverview.textContent = `所持数: ${Number.isFinite(count) ? `${count}個` : "データがありません。"}`;
        overviewGroup.append(countOverview);
        button.ariaLabel = `グッズの詳細を開く、${name}、${descriptionText}`;
        button.addEventListener("click", () => {
            if(!isOpenDisabled) {
                fn.openGoods(g.id);
            }
        });
        if(!colorUse) {
            color = null;
        }
        const textColor = fn.getContrastColor(color, "text");
        const overviewColor = fn.getContrastColor(color, "overview");
        button.style.setProperty("--folder-text-color", textColor);
        button.style.setProperty("--folder-overview-color", overviewColor);
        if(color && colorUse) {
            button.style.setProperty("--folder-color", color);
        }
        box.append(button);
        if(g.favorite) {
            favoriteGoodsListEle.append(box);
        } else {
            goodsListEle.append(box);
        }
    });
    return true;
}

export async function applyPageHistoryButtons(pageChangeHistory, currentFolderId, fn) {
    const pageHistoryButtonGroupEle = document.getElementById("page-history-button-group");
    pageHistoryButtonGroupEle.innerHTML = "";
    if(currentFolderId !== 0) {
        let buttonId = 0;
        const history = [...pageChangeHistory, currentFolderId];
        for (const [index, id] of history.entries()) {
            const pageHistoryButtonBox = document.createElement("span");
            pageHistoryButtonBox.classList.add("page-history-button-box");
            const folder = await fn.getCurrentFolder(id);
            const text = (id === 0) ? "My Collections" : (folder?.name ?? "アルバム");
            if(index < history.length - 1) {
                const button = document.createElement("button");
                button.classList.add("page-history-button");
                button.dataset.buttonId = buttonId;
                button.textContent = text;
                if(buttonId < pageChangeHistory.length) {
                    button.addEventListener("click", async () => {
                        const backId = pageChangeHistory.length - Number(button.dataset.buttonId);
                        await fn.pageBack(backId);
                    });
                }
                buttonId++;
                pageHistoryButtonBox.append(button);
                const pageHistoryArrow = document.createElement("span");
                pageHistoryArrow.classList.add("page-history-arrow");
                pageHistoryArrow.textContent = " > ";
                pageHistoryArrow.ariaHidden = true;
                pageHistoryButtonBox.append(pageHistoryArrow);
            } else {
                const span = document.createElement("span");
                span.classList.add("page-history-button");
                span.textContent = text;
                pageHistoryButtonBox.append(span);
            }
            pageHistoryButtonGroupEle.append(pageHistoryButtonBox);
        }
    }
}

export function applyCustomPenlight(settings) {
    const penlightSelectEle = document.getElementById("penlight-select");
    if(penlightSelectEle && Array.isArray(settings.penlight?.list)) {
        penlightSelectEle.innerHTML = "";
        const items = [{
            value: "",
            text: "デフォルト"
        }, ...settings.penlight.list.map((color) => ({
            value: color.id,
            text: color.name
        }))];
        const useId = settings?.penlight?.usePenlightId;
        items.forEach((penlight) => {
            const option = document.createElement("option");
            option.value = penlight.value;
            option.textContent = penlight.text;
            if(penlight.value === useId) {
                option.selected = true;
            }
            penlightSelectEle.append(option);
        });
        if(items.length < 2) {
            penlightSelectEle.disabled = true;
        } else {
            penlightSelectEle.disabled = false;
        }
    }
}