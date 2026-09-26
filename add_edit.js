const MAX_PIXELS = 100000;
const SUPPORTED_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp"
];
const IMAGE_POSITION_LIST = {
    center: "中央",
    left: "左",
    right: "右",
    top: "上",
    bottom: "下"
};
const HORIZONTAL_POSITIONS = ["center", "left", "right"];
const VERTICAL_POSITIONS = ["center", "top", "bottom"];
let loadedImage;
let folderHistory = [];
let selectedFolders = [];
let isProcessingImage = false;
let isProcessingSelectedFolders = false;

export function addEditItemPopup(settings, currentFolderId, currentFolder, currentGoods, loadedFolders, CATEGORY_LIST, type, mode, fn) {
    folderHistory = [];
    selectedFolders = [];
    const editingItem = mode === "edit" ? (type === "folder" ? currentFolder : currentGoods) : null;
    const popupContent = document.createElement("div");
    const imageGroup = document.createElement("div");
    imageGroup.classList.add("image-input-group");
    const importResult = document.createElement("div");
    importResult.id = "import-results";
    const blob = mode === "edit" ? (editingItem.image ?? null) : null;
    const imagePositionGroup = document.createElement("label");
    const imagePositionSelect = document.createElement("select");
    imagePositionSelect.id = "image-position-select";
    for (const [value, label] of Object.entries(IMAGE_POSITION_LIST)) {
        const option = document.createElement("option");
        option.id = `image-position-${value}`;
        option.classList.add("image-position-option");
        option.value = value;
        option.textContent = label;
        option.disabled = true;
        imagePositionSelect.append(option);
    }
    imagePositionSelect.value = "center";
    imagePositionSelect.classList.add("disabled");
    imagePositionSelect.disabled = true;
    imagePositionSelect.addEventListener("change", () => {
        const importedImageEle = document.getElementById("imported-image");
        if(importedImageEle) {
            importedImageEle.style.objectPosition = fn.getImagePosition(imagePositionSelect.value);
        }
    });
    imagePositionGroup.append("表示する位置: ", imagePositionSelect);
    if(!blob) {
        importResult.append(fn.getSymbolSvg(type === "folder" ? "folder" : "", "import-symbol-svg"));
    } else {
        try {
            loadedImage = blob;
            const url = URL.createObjectURL(blob);
            const img = document.createElement("img");
            img.id = "imported-image";
            img.src = url;
            importResult.append(img);
            const position = editingItem.imagePosition;
            if(position) {
                img.style.objectPosition = fn.getImagePosition(position);
            }
            img.onload = () => {
                const imageWidth = img.naturalWidth ?? 0;
                const imageHeight = img.naturalHeight ?? 0;
                if(imageWidth > imageHeight) {
                    HORIZONTAL_POSITIONS.forEach((p) => {
                        const targetEle = document.getElementById(`image-position-${p}`);
                        if(targetEle) {
                            targetEle.disabled = false;
                        }
                    });
                } else if(imageWidth < imageHeight) {
                    VERTICAL_POSITIONS.forEach((p) => {
                        const targetEle = document.getElementById(`image-position-${p}`);
                        if(targetEle) {
                            targetEle.disabled = false;
                        }
                    });
                }
                imagePositionSelect.value = position ?? "center";
                imagePositionSelect.classList.remove("disabled");
                imagePositionSelect.disabled = false;
                URL.revokeObjectURL(url);
            }
            img.onerror = () => {
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            loadedImage = null;
            console.error("Error processing image:", error);
            fn.showBanner("エラーが発生しました。");
            return;
        }
    }
    const removeImageButton = document.createElement("button");
    removeImageButton.id = "remove-image-button";
    removeImageButton.textContent = "画像を削除";
    removeImageButton.addEventListener("click", () => {
        fn.showBanner("画像を削除しますか？", [{
            text: "削除",
            fn: removeImage,
            arg: [{
                getSymbolSvg: fn.getSymbolSvg
            }]
        }, {
            text: "キャンセル"
        }]);
    });
    if(mode === "add" || !blob) {
        removeImageButton.style.display = "none";
    }
    imageGroup.append(importResult, removeImageButton);
    const imageInputGroup = document.createElement("p");
    const imageInput = document.createElement("input");
    imageInput.id = "image-input";
    imageInput.type = "file";
    imageInput.accept = "image/*";
    imageInput.addEventListener("change", () => {
        changeImage({
            getSymbolSvg: fn.getSymbolSvg,
            showBanner: fn.showBanner
        });
    });
    const imageInputLabel = document.createElement("label");
    imageInputLabel.append(type === "folder" ? "アルバムのサムネにする画像を選択: " : "グッズの画像を選択: ", imageInput);
    imageInputGroup.append(imageInputLabel);
    imageGroup.append(imageInputGroup);
    imageGroup.append(imagePositionGroup);
    popupContent.append(imageGroup);
    const nameGroup = document.createElement("label");
    nameGroup.classList.add("data-input-group");
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.id = "name-input";
    nameInput.placeholder = type === "folder" ? "例: 推し活" : "例: アクスタ";
    nameGroup.append(type === "folder" ? "アルバム名: " : "グッズ名: ", nameInput);
    popupContent.append(nameGroup);
    const descriptionGroup = document.createElement("label");
    descriptionGroup.classList.add("data-input-group");
    const descriptionTextArea = document.createElement("textarea");
    descriptionTextArea.id = "description-input";
    descriptionTextArea.placeholder = type === "folder" ? "例: 推し活で集めたグッズ" : "例: 推しのアクスタ";
    descriptionGroup.append(type === "folder" ? "アルバムの説明: " : "グッズの説明: ", descriptionTextArea);
    popupContent.append(descriptionGroup);
    if(mode === "edit") {
        nameInput.value = editingItem?.name ?? "";
        descriptionTextArea.value = editingItem?.description ?? "";
    }
    if(type === "folder") {
        const colorGroup = document.createElement("label");
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.id = "folder-color";
        colorInput.value = "#ffc0cb";
        colorInput.addEventListener("change", () => {
            changeFolderColor(colorInput.value);
        });
        colorGroup.append("アルバムのテーマカラー: ", colorInput);
        popupContent.append(colorGroup);
        const colorUseInputGroup = document.createElement("div");
        const colorUseInputLabel = document.createElement("label");
        const colorUseInput = document.createElement("input");
        colorUseInput.id = "color-use-input";
        colorUseInput.type = "checkbox";
        colorUseInput.checked = true;
        colorUseInputLabel.append(colorUseInput, "テーマカラーを使用する");
        colorUseInputGroup.append(colorUseInputLabel);
        popupContent.append(colorUseInputGroup);
        if(mode === "edit") {
            colorInput.value = editingItem?.color ?? "#ffc0cb";
            colorUseInput.checked = editingItem?.colorUse ?? true;
            colorUseInput.style.accentColor = editingItem?.color ?? "#ffc0cb";
        }
        fn.showPopup(popupContent, [{
            text: mode === "add" ? "+追加" : "完了",
            fn: addEditFolder,
            arg: [currentFolderId, currentFolder, mode, {
                showBanner: fn.showBanner,
                saveFolder: fn.saveFolder,
                openFolder: fn.openFolder
            }]
        }, {
            text: "キャンセル",
            fn: imageInit
        }]);
    } else {
        const countGroup = document.createElement("label");
        const countInput = document.createElement("input");
        countInput.type = "number";
        countInput.inputMode = "numeric";
        countInput.id = "goods-count-input";
        countInput.placeholder = "空の場合0になります。";
        countInput.min = "0";
        countInput.value = "1";
        countGroup.append("所持数: ", countInput);
        popupContent.append(countGroup);
        const tagInputGroup = document.createElement("label");
        tagInputGroup.classList.add("data-input-group");
        const tagInput = document.createElement("input");
        tagInput.type = "text";
        tagInput.id = "goods-tag-input";
        tagInput.placeholder = "例: 推し, アクスタ(#で区切る: 推し#アクスタ)";
        tagInputGroup.append("タグ（「タグを追加」ボタンをクリックまたはタップしてください。）: ", tagInput);
        const addTagButtonGroup = document.createElement("div");
        addTagButtonGroup.classList.add("button-group");
        const addTagButton = document.createElement("button");
        addTagButton.textContent = "タグを追加";
        addTagButton.addEventListener("click", () => {
            addTag({
                showBanner: fn.showBanner
            });
        });
        addTagButtonGroup.append(addTagButton);
        tagInputGroup.append(addTagButtonGroup);
        popupContent.append(tagInputGroup);
        const registeredTags = document.createElement("div");
        registeredTags.id = "registered-tags";
        registeredTags.classList.add("tag-group");
        popupContent.append(registeredTags);
        const categoryGroup = document.createElement("div");
        const categorySelect = document.createElement("select");
        categorySelect.id = "goods-category-select";
        const defaultOpt = document.createElement("option");
        defaultOpt.value = "";
        defaultOpt.textContent = "--カテゴリを選択してください。";
        defaultOpt.selected = true;
        defaultOpt.disabled = true;
        categorySelect.append(defaultOpt);
        for(const [key, value] of Object.entries(CATEGORY_LIST)) {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = value;
            categorySelect.append(opt);
        }
        categoryGroup.append("カテゴリ: ", categorySelect);
        popupContent.append(categoryGroup);
        categorySelect.addEventListener("change", (e) => {
            changeCategory(e.target.value, {
                getSymbolSvg: fn.getSymbolSvg
            });
        });
        const saveFolderGroup = document.createElement("div");
        saveFolderGroup.id = "save-folder-group";
        const selectFolderDescription = document.createElement("div");
        selectFolderDescription.classList.add("description");
        selectFolderDescription.textContent = "追加するアルバムを選択";
        saveFolderGroup.append(selectFolderDescription);
        const historyGroup = document.createElement("div");
        historyGroup.id = "save-folder-history-group";
        saveFolderGroup.append(historyGroup);
        const backButtonGroup = document.createElement("div");
        backButtonGroup.classList.add("page-back-button-group");
        const backButton = document.createElement("button");
        backButton.classList.add("back-button");
        backButton.id = "folder-back-button";
        const SVG_NS = "http://www.w3.org/2000/svg";
        const backArrow = document.createElementNS(SVG_NS, "svg");
        backArrow.classList.add("text-svg", "page-back-svg");
        backArrow.setAttribute("viewBox", "0 0 16 16");
        backArrow.setAttribute("width", "16");
        backArrow.setAttribute("height", "16");
        const backArrowG = document.createElementNS(SVG_NS, "g");
        backArrowG.classList.add("text-svg");
        backArrowG.setAttribute("fill", "none");
        backArrowG.setAttribute("stroke", "currentColor");
        backArrowG.setAttribute("stroke-width", "2");
        const backArrowPath = document.createElementNS(SVG_NS, "path");
        backArrowPath.setAttribute("d", "M 10 2 L 6 8 L 10 14");
        const backText = document.createElement("span");
        backText.textContent = "Back";
        backArrowG.append(backArrowPath);
        backArrow.append(backArrowG);
        backButton.append(backArrow, backText);
        backButton.addEventListener("click", () => {
            backFolder(settings, loadedFolders, 1, {
                getChildFolders: fn.getChildFolders,
                getSymbolSvg: fn.getSymbolSvg,
                getImagePosition: fn.getImagePosition,
                getCurrentFolder: fn.getCurrentFolder
            });
        });
        backButtonGroup.append(backButton);
        saveFolderGroup.append(backButtonGroup);
        const selectFolderGroup = document.createElement("div");
        selectFolderGroup.id = "select-folder-group";
        saveFolderGroup.append(selectFolderGroup);
        const selectedFolderGroup = document.createElement("div");
        selectedFolderGroup.id = "selected-folder-group";
        const selectedFolderDescription = document.createElement("div");
        selectedFolderDescription.classList.add("description");
        selectedFolderDescription.textContent = "追加するアルバム";
        selectedFolderGroup.append(selectedFolderDescription);
        saveFolderGroup.append(selectedFolderGroup);
        popupContent.append(saveFolderGroup);
        if(mode === "edit") {
            countInput.value = editingItem?.count ?? 1;
            categorySelect.value = editingItem?.category ?? "";
            (editingItem?.tags ?? []).forEach((t) => {
                const tag = document.createElement("button");
                tag.classList.add("input-tag");
                tag.textContent = t;
                tag.dataset.name = t;
                tag.addEventListener("click", () => {
                    const tagStyle = document.createElement("span");
                    tagStyle.classList.add("tag");
                    tagStyle.textContent = t;
                    const message = document.createElement("div");
                    message.append(tagStyle, "を削除しますか？");
                    fn.showBanner(message, [{
                        text: "削除",
                        fn: removeTag,
                        arg: [tag]
                    }, {
                        text: "キャンセル"
                    }]);
                });
                registeredTags.append(tag);
            });
        }
        fn.showPopup(popupContent, [{
            text: mode === "add" ? "+追加" : "完了",
            fn: addEditGoods,
            arg: [currentFolderId, mode, {
                showBanner: fn.showBanner,
                saveGoods: fn.saveGoods,
                openFolder: fn.openFolder
            }]
        }, {
            text: "キャンセル",
            fn: imageInit
        }]);
        moveFolder(settings, 0, loadedFolders, "init", {
            getChildFolders: fn.getChildFolders,
            getSymbolSvg: fn.getSymbolSvg,
            getImagePosition: fn.getImagePosition,
            getCurrentFolder: fn.getCurrentFolder
        });
        if(mode === "add") {
            selectFolder(currentFolder, {
                getImagePosition: fn.getImagePosition,
                getSymbolSvg: fn.getSymbolSvg
            });
        } else {
            isProcessingSelectedFolders = true;
            const selectedList = currentGoods.folderId;
            Promise.all(
                selectedList.map((folderId) => fn.getCurrentFolder(folderId))
            ).then((folders) => {
                folders.forEach((folder) => {
                    selectFolder(folder, {
                        getImagePosition: fn.getImagePosition,
                        getSymbolSvg: fn.getSymbolSvg
                    });
                });
            }).catch((error) => {
                console.error("Error loading selected folders:", error);
            }).finally(() => {
                isProcessingSelectedFolders = false;
            });
        }
    }
    if(mode === "edit") {
        return false;
    }
}

function addEditFolder(currentFolderId, currentFolder, mode, fn) {
    const imagePositionSelectEle = document.getElementById("image-position-select");
    const imagePosition = imagePositionSelectEle?.value;
    const nameEle = document.getElementById("name-input");
    const name = nameEle?.value.trim();
    if(!name) {
        fn.showBanner("アルバム名を入力してください。");
        return false;
    }
    if(isProcessingImage) {
        fn.showBanner("画像の読み込みが完了するまでお待ちください。");
        return false;
    }
    const descriptionEle = document.getElementById("description-input");
    const description = descriptionEle?.value?.trim();
    const colorEle = document.getElementById("folder-color");
    const color = colorEle?.value;
    const colorUseInputEle = document.getElementById("color-use-input");
    const colorUse = colorUseInputEle?.checked ?? true;
    const newFolder = {
        image: loadedImage,
        imagePosition: imagePosition,
        favorite: false,
        bookmark: false,
        name: name,
        description: description,
        color: color,
        colorUse: colorUse,
        parentId: mode === "add" ? currentFolderId ?? 0 : currentFolder?.parentId ?? 0
    }
    fn.saveFolder(newFolder, mode).then(async () => {
        await fn.openFolder(currentFolderId, "update");
    }).catch((error) => {
        console.error(`Error saving folder: ${error}`);
        fn.showBanner("データの保存に失敗しました。");
    });
    loadedImage = null;
}

function addEditGoods(currentFolderId, mode, fn) {
    const imagePositionSelectEle = document.getElementById("image-position-select");
    const imagePosition = imagePositionSelectEle?.value;
    const nameEle = document.getElementById("name-input");
    const name = nameEle?.value.trim();
    if(!name) {
        fn.showBanner("グッズ名を入力してください。");
        return false;
    }
    if(selectedFolders.length === 0) {
        if(isProcessingSelectedFolders) {
            fn.showBanner("アルバムの読み込みが完了するまでお待ちください。");
        } else {
            fn.showBanner("追加するアルバムを選択してください。");
        }
        return false;
    }
    if(isProcessingImage) {
        fn.showBanner("画像の読み込みが完了するまでお待ちください。");
        return false;
    }
    if(isProcessingSelectedFolders) {
        fn.showBanner("アルバムの読み込みが完了するまでお待ちください。");
        return false;
    }
    const descriptionEle = document.getElementById("description-input");
    const description = descriptionEle?.value?.trim();
    const countEle = document.getElementById("goods-count-input");
    let count = parseInt(countEle?.value ?? -1);
    if(!Number.isFinite(count) || count < 0) {
        count = 0;
    }
    const tagEles = document.querySelectorAll(".input-tag");
    const tags = Array.from(tagEles).map(ele => ele.dataset.name).filter(t => t !== "");
    const categoryEle = document.getElementById("goods-category-select");
    const category = categoryEle?.value;
    const newGoods = {
        image: loadedImage,
        imagePosition: imagePosition,
        favorite: false,
        name: name,
        description: description,
        count: count,
        tags: tags,
        category: category,
        folderId: Array.from(new Set(selectedFolders))
    };
    fn.saveGoods(newGoods, mode).then(async () => {
        await fn.openFolder(currentFolderId, "update");
    }).catch((error) => {
        console.error(`Error saving goods: ${error}`);
        fn.showBanner("データの保存に失敗しました。");
    });
    loadedImage = null;
}

async function moveFolder(settings, folderId, loadedFolders, mode, fn) {
    let folders;
    if(loadedFolders.has(folderId)) {
        folders = loadedFolders.get(folderId).folders;
    } else {
        folders = await fn.getChildFolders(folderId);
    }
    const selectFolderGroupEle = document.getElementById("select-folder-group");
    selectFolderGroupEle.innerHTML = "";
    if(mode !== "back") {
        folderHistory.push(folderId);
    }
    console.log(folderHistory);
    const backButtonEle = document.getElementById("folder-back-button");
    const saveFolderHistoryGroupEle = document.getElementById("save-folder-history-group");
    if(folderHistory.length <= 1) {
        if(backButtonEle) {
            backButtonEle.style.display = "none";
        }
        if(saveFolderHistoryGroupEle) {
            saveFolderHistoryGroupEle.style.display = "none";
        }
    } else {
        if(backButtonEle) {
            backButtonEle.style.removeProperty("display");
        }
        if(saveFolderHistoryGroupEle) {
            saveFolderHistoryGroupEle.style.removeProperty("display");
        }
    }
    if(folders.length === 0 && folderId !== 0) {
        const message = document.createElement("div");
        message.textContent = "このアルバムにはアルバムがありません。";
        selectFolderGroupEle.append(message);
    } else {
        const folderList = folderId === 0 ? [{
            id: 0
        }, ...folders] : folders;
        console.log(folders);
        folderList.forEach((f) => {
            const buttonGroup = document.createElement("div");
            buttonGroup.classList.add("button-group");
            const addButton = document.createElement("button");
            addButton.textContent = "+選択";
            addButton.addEventListener("click", () => {
                selectFolder(f, {
                    getImagePosition: fn.getImagePosition,
                    getSymbolSvg: fn.getSymbolSvg
                });
            });
            if((f.id ?? 0) !== 0) {
                const openButton = document.createElement("button");
                openButton.textContent = "開く>";
                openButton.addEventListener("click", () => {
                    moveFolder(settings, f.id, loadedFolders, "open", fn);
                });
                buttonGroup.append(addButton, openButton);
            } else {
                buttonGroup.append(addButton);
            }
            selectFolderGroupEle.append(returnFolderGroup(f, buttonGroup, {
                getImagePosition: fn.getImagePosition,
                getSymbolSvg: fn.getSymbolSvg
            }));
        });
    }
    showFolderHistory(settings, loadedFolders, fn);
}

function showFolderHistory(settings, loadedFolders, fn) {
    const saveFolderHistoryGroupEle = document.getElementById("save-folder-history-group");
    if(saveFolderHistoryGroupEle) {
        saveFolderHistoryGroupEle.innerHTML = "";
        folderHistory.forEach(async (folderId, index) => {
            const folder = await fn.getCurrentFolder(folderId);
            const name = folder?.name ?? "My Collections";
            const pageHistoryButtonBox = document.createElement("span");
            pageHistoryButtonBox.classList.add("page-history-button-box");
            if(folderHistory.length - 1 === index) {
                const span = document.createElement("span");
                span.textContent = name;
                saveFolderHistoryGroupEle.append(pageHistoryButtonBox);
                pageHistoryButtonBox.append(span);
            } else {
                const button = document.createElement("button");
                button.classList.add("page-history-button");
                button.textContent = name;
                button.dataset.backCount = index;
                button.addEventListener("click", () => {
                    const backId = folderHistory.length - index - 1;
                    console.log(index, backId, folderHistory);
                    backFolder(settings, loadedFolders, backId, fn);
                });
                const arrow = document.createElement("span");
                arrow.classList.add("page-history-arrow");
                arrow.textContent = ">";
                pageHistoryButtonBox.append(button, arrow);
                saveFolderHistoryGroupEle.append(pageHistoryButtonBox);
            }
        });
    }
}

function returnFolderGroup(folder, buttonGroup, fn) {
    const folderGroup = document.createElement("div");
    folderGroup.classList.add("folder-group");
    const folderImageGroup = document.createElement("div");
    folderImageGroup.classList.add("folder-image-group");
    const image = folder?.image;
    if(image && !settings?.checkbox?.["privacy-protection"]) {
        const url = URL.createObjectURL(image);
        const img = document.createElement("img");
        img.classList.add("folder-image");
        img.src = url;
        img.alt = "";
        img.style.objectPosition = fn.getImagePosition(folder?.imagePosition);
        img.onload = () => {
            URL.revokeObjectURL(url);
        }
        folderImageGroup.append(img);
    } else {
        const symbolSvg = fn.getSymbolSvg("folder", "folder-symbol-svg");
        folderImageGroup.append(symbolSvg);
    }
    folderGroup.append(folderImageGroup);
    const name = folder?.name ?? "My Collections";
    const overviewArrowGroup = document.createElement("div");
    overviewArrowGroup.classList.add("overview-arrow-group");
    const overviewGroup = document.createElement("div");
    overviewGroup.classList.add("overview-group");
    const title = document.createElement("div");
    title.textContent = name;
    title.classList.add("folder-title");
    overviewGroup.append(title);
    const description = document.createElement("div");
    const descriptionText = (folder?.description ?? "") === "" ? "説明はありません。" : folder?.description;
    description.classList.add("overview");
    description.textContent = descriptionText;
    overviewGroup.append(description);
    folderGroup.append(overviewGroup);
    folderGroup.append(buttonGroup);
    return folderGroup;
}

function backFolder(settings, loadedFolders, count, fn) {
    let openId = 0;
    if(folderHistory.length > 0) {
        openId = folderHistory.at((count + 1) * -1);
        folderHistory.splice(count * -1);
        console.log(openId, folderHistory);
    }
    console.log(folderHistory);
    moveFolder(settings, openId, loadedFolders, "back", fn);
}

function selectFolder(folder, fn) {
    const id = folder?.id ?? 0;
    if(!selectedFolders.includes(id)) {
        selectedFolders.push(id);
        const selectedFolderGroupEle = document.getElementById("selected-folder-group");
        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("button-group");
        const deselectedButton = document.createElement("button");
        deselectedButton.textContent = "選択解除";
        buttonGroup.append(deselectedButton);
        const folderContent = returnFolderGroup(folder, buttonGroup, fn);
        deselectedButton.addEventListener("click", () => {
            deselectFolder(id, folderContent);
        });
        if(selectedFolderGroupEle) {
            selectedFolderGroupEle.append(folderContent);
        }
    }
    console.log(selectedFolders);
}

function deselectFolder(folderId, ele) {
    selectedFolders = selectedFolders.filter(id => id !== folderId);
    ele.remove();
    console.log(selectedFolders);
}

function imageInit() {
    loadedImage = null;
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };
        img.src = url;
    });
}

function getOutputType(file) {
    if(SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        return file.type;
    }
    return "image/png";
}

function getResizeSize(width, height) {
    const pixels = width * height;
    if(pixels <= MAX_PIXELS) {
        return [width, height];
    }
    const scale = Math.sqrt(MAX_PIXELS / pixels);
    return [Math.floor(width * scale), Math.floor(height * scale)];
}

function canvasToBlob(canvas, type) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if(blob) {
                resolve(blob);
            } else {
                reject(new Error("Failed to convert canvas to blob"));
            }
        }, type, (type === "image/png" ? null : 0.9));
    });
}

async function processImage(file) {
    const img = await loadImage(file);
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    const [width, height] = getResizeSize(originalWidth, originalHeight);
    const outputType = getOutputType(file);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if(!ctx) {
        throw new Error("Failed to get canvas context");
    }
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, outputType);
    return {
        blob,
        width,
        height,
        type: outputType
    };
}

async function changeImage(fn) {
    const imageInputEle = document.getElementById("image-input");
    if(!imageInputEle) {
        return;
    }
    if(imageInputEle.files.length > 0) {
        const file = imageInputEle.files[0];
        const imagePositionSelectEle = document.getElementById("image-position-select");
        const removeImageButtonEle = document.getElementById("remove-image-button");
        if(!/^image\/.*/.test(file.type)) {
            imageInputEle.value = "";
            fn.showBanner("無効なファイル形式です。");
            removeImage({
                getSymbolSvg: fn.getSymbolSvg
            });
            return;
        }
        isProcessingImage = true;
        try {
            const importResultsEle = document.getElementById("import-results");
            if(importResultsEle) {
                const result = await processImage(file);
                const blob = result.blob;
                loadedImage = blob;
                importResultsEle.innerHTML = "";
                const url = URL.createObjectURL(blob);
                const img = document.createElement("img");
                img.id = "imported-image";
                img.src = url;
                importResultsEle.append(img);
                img.onload = () => {
                    if(imagePositionSelectEle) {
                        const imageWidth = img.naturalWidth ?? 0;
                        const imageHeight = img.naturalHeight ?? 0;
                        const optionEles = document.querySelectorAll(".image-position-option");
                        optionEles.forEach((o) => {
                            o.disabled = true;
                        });
                        if(imageWidth > imageHeight) {
                            HORIZONTAL_POSITIONS.forEach((p) => {
                                const targetEle = document.getElementById(`image-position-${p}`);
                                if(targetEle) {
                                    targetEle.disabled = false;
                                }
                            });
                        } else if(imageWidth < imageHeight) {
                            VERTICAL_POSITIONS.forEach((p) => {
                                const targetEle = document.getElementById(`image-position-${p}`);
                                if(targetEle) {
                                    targetEle.disabled = false;
                                }
                            });
                        }
                        imagePositionSelectEle.value = "center";
                        imagePositionSelectEle.classList.remove("disabled");
                        imagePositionSelectEle.disabled = false;
                    }
                    if(removeImageButtonEle) {
                        removeImageButtonEle.style.removeProperty("display");
                    }
                    URL.revokeObjectURL(url);
                }
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                }
            }
        } catch (error) {
            console.error("Error processing image:", error);
        } finally {
            isProcessingImage = false;
        }
    }
}

function removeImage(fn) {
    loadedImage = null;
    const removeImageButtonEle = document.getElementById("remove-image-button");
    if(removeImageButtonEle) {
        removeImageButtonEle.style.display = "none";
    }
    const imageInputEle = document.getElementById("image-input");
    if(imageInputEle) {
        imageInputEle.value = "";
    }
    const imagePositionSelectEle = document.getElementById("image-position-select");
    if(imagePositionSelectEle) {
        imagePositionSelectEle.value = "center";
        const imagePositionOptionEles = document.querySelectorAll(".image-position-option");
        imagePositionOptionEles.forEach((o) => {
            o.disabled = true;
        });
        imagePositionSelectEle.classList.add("disabled");
        imagePositionSelectEle.disabled = true;
    }
    const categorySelectEle = document.getElementById("goods-category-select");
    let category;
    if(categorySelectEle) {
        category = categorySelectEle.value;
    }
    changeCategory(category, {
        getSymbolSvg: fn.getSymbolSvg
    });
}

function changeFolderColor(color) {
    const colorUseInputEle = document.getElementById("color-use-input");
    if(colorUseInputEle) {
        colorUseInputEle.style.accentColor = color;
    }
}

function addTag(fn) {
    const tagInputEle = document.getElementById("goods-tag-input");
    const tagName = tagInputEle?.value ?? "";
    const registeredTagsEle = document.getElementById("registered-tags");
    const tags = tagName.split("#").map((tag) => tag.trim());
    let useTags = [];
    if(tagInputEle && registeredTagsEle) {
        const tagEles = document.querySelectorAll(".input-tag");
        const tagList = Array.from(tagEles).map(ele => ele.dataset.name);
        for(let i = 0; i < tags.length; i++) {
            if(!useTags.some((t) => t === tags[i]) && !(/^\s*$/.test(tags[i])) && !tagList.includes(tags[i])) {
                useTags.push(tags[i]);
            }
        }
        for(const tag of useTags) {
            const tagEle = document.createElement("button");
            tagEle.classList.add("input-tag");
            tagEle.textContent = tag;
            tagEle.dataset.name = tag;
            tagEle.addEventListener("click", () => {
                const tagStyle = document.createElement("span");
                tagStyle.classList.add("tag");
                tagStyle.textContent = tag;
                const message = document.createElement("div");
                message.append(tagStyle, "を削除しますか？");
                fn.showBanner(message, [{
                    text: "削除",
                    fn: removeTag,
                    arg: [tag]
                }, {
                    text: "キャンセル"
                }]);
            });
            registeredTagsEle.append(tagEle);
        }
        if(useTags.length === 0) {
            fn.showBanner("有効なタグを入力してください。");
        } else if(tags.length !== useTags.length) {
            fn.showBanner("有効なタグのみ追加しました。");
        }
        tagInputEle.value = "";
    } else {
        fn.showBanner("エラーが発生しました。");
    }
}

function removeTag(removeEle) {
    removeEle.remove();
}

function changeCategory(value, fn) {
    if(loadedImage) {
        return;
    }
    const importResultEle = document.getElementById("import-results");
    if(importResultEle) {
        importResultEle.innerHTML = "";
        importResultEle.append(fn.getSymbolSvg(value, "import-symbol-svg"));
    } else {
        console.error("Import results element not found");
    }
}