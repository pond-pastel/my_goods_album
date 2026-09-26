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

export async function applyCollection(folders, goods, currentFolder, settings, CATEGORY_LIST, fn) {
    const folderResult = applyFolder(folders, settings, {
        getSymbolSvg: fn.getSymbolSvg,
        openFolder: fn.openFolder,
        getContrastColor: fn.getContrastColor,
        getImagePosition: fn.getImagePosition
    });
    const goodsResult = applyGoods(goods, currentFolder, settings, CATEGORY_LIST, {
        getSymbolSvg: fn.getSymbolSvg,
        openGoods: fn.openGoods,
        getContrastColor: fn.getContrastColor,
        getImagePosition: fn.getImagePosition
    });
    const noItemsMessageEle = document.getElementById("no-items-message");
    if(!folderResult && !goodsResult) {
        noItemsMessageEle.style.display = "block";
    } else {
        noItemsMessageEle.style.removeProperty("display");
    }
}

function applyFolder(folders, settings, fn) {
    const folderListEle = document.getElementById("folder-list");
    folderListEle.innerHTML = "";
    if((folders ?? []).length === 0) {
        return false;
    }
    const isImageHidden = settings?.checkbox?.["privacy-protection"];
    folders.forEach((f) => {
        const name = (f.name ?? "") === "" ? "無題" : f.name;
        const image = f.image;
        const box = document.createElement("div");
        const button = document.createElement("button");
        button.classList.add("folder-button");
        button.title = name;
        if(image && !isImageHidden) {
            const url = URL.createObjectURL(image);
            const img = document.createElement("img");
            img.classList.add("folder-image");
            img.src = url;
            img.alt = "";
            img.style.objectPosition = fn.getImagePosition(f.imagePosition);
            img.onload = () => {
                URL.revokeObjectURL(url);
            }
            button.append(img);
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
        const SVG_NS = "http://www.w3.org/2000/svg";
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
        button.ariaLabel = `フォルダを開く、${name}、${descriptionText}`;
        button.addEventListener("click", async () => {
            await fn.openFolder(f.id, "open");
        });
        box.append(button);
        folderListEle.append(box);
    });
    return true;
}

function applyGoods(goods, currentFolder, settings, CATEGORY_LIST, fn) {
    const goodsListEle = document.getElementById("goods-list");
    goodsListEle.innerHTML = "";
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
        button.classList.add("goods-button");
        button.title = name;
        if(image && !isImageHidden) {
            const url = URL.createObjectURL(image);
            const img = document.createElement("img");
            img.classList.add("goods-image");
            img.src = url;
            img.alt = "";
            img.style.objectPosition = fn.getImagePosition(g.imagePosition);
            img.onload = () => {
                URL.revokeObjectURL(url);
            };
            button.append(img);
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
            fn.openGoods(g.id);
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
        goodsListEle.append(box);
    });
    return true;
}

export async function applyPageHistoryButtons(pageChangeHistory, currentFolderId, fn) {
    const pageHistoryButtonGroupEle = document.getElementById("page-history-button-group");
    pageHistoryButtonGroupEle.innerHTML = "";
    if(currentFolderId !== 0) {
        let buttonId = 0;
        for (const id of [...pageChangeHistory, currentFolderId]) {
            const pageHistoryButtonBox = document.createElement("span");
            pageHistoryButtonBox.classList.add("page-history-button-box");
            const folder = await fn.getCurrentFolder(id);
            const text = (id === 0) ? "My Collections" : (folder?.name ?? "アルバム");
            if(id !== currentFolderId) {
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