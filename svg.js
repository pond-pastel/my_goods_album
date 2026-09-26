export function getSymbolSvg(name, className) {
    const SVG_NS = "http://www.w3.org/2000/svg";
    const symbolSvg = document.createElementNS(SVG_NS, "svg");
    symbolSvg.classList.add(className);
    symbolSvg.ariaHidden = true;
    symbolSvg.setAttribute("viewBox", "0 0 100 100");
    switch(name) {
        case "folder":
            const folderSvgG = document.createElementNS(SVG_NS, "g");
            folderSvgG.classList.add("symbol-svg");
            folderSvgG.setAttribute("fill", "none");
            folderSvgG.setAttribute("stroke", "currentColor");
            folderSvgG.setAttribute("stroke-width", "2");
            const folderSvgPath = document.createElementNS(SVG_NS, "path");
            folderSvgPath.setAttribute("d", "M 20 30 Q 20 25, 25 25 H 40 Q 45 25, 45 30 Q 45 35, 50 35 H 75 Q 80 35, 80 40 V 70 Q 80 75, 75 75 H 25 Q 20 75, 20 70 Z M 25 45 H 75");
            folderSvgG.append(folderSvgPath);
            symbolSvg.append(folderSvgG);
            break;

        case "photo":
            const photoSvgG = document.createElementNS(SVG_NS, "g");
            photoSvgG.classList.add("symbol-svg");
            photoSvgG.setAttribute("fill", "none");
            photoSvgG.setAttribute("stroke", "currentColor");
            photoSvgG.setAttribute("stroke-width", "2");
            const photoSvgRect = document.createElementNS(SVG_NS, "rect");
            photoSvgRect.setAttribute("x", "27");
            photoSvgRect.setAttribute("y", "20");
            photoSvgRect.setAttribute("width", "46");
            photoSvgRect.setAttribute("height", "60");
            photoSvgG.append(photoSvgRect);
            symbolSvg.append(photoSvgG);
            const fillPhotoSvgG = document.createElementNS(SVG_NS, "g");
            fillPhotoSvgG.classList.add("fill-symbol-svg");
            fillPhotoSvgG.setAttribute("fill", "currentColor");
            const fillPhotoSvgRect = document.createElementNS(SVG_NS, "rect");
            fillPhotoSvgRect.setAttribute("x", "27");
            fillPhotoSvgRect.setAttribute("y", "70");
            fillPhotoSvgRect.setAttribute("width", "46");
            fillPhotoSvgRect.setAttribute("height", "10");
            fillPhotoSvgG.append(fillPhotoSvgRect);
            const fillPhotoSvgPath = document.createElementNS(SVG_NS, "path");
            fillPhotoSvgPath.setAttribute("d", "M 30 68 A 1 1 0 0 1 70 68 Z");
            fillPhotoSvgG.append(fillPhotoSvgPath);
            const fillPhotoSvgCircle = document.createElementNS(SVG_NS, "circle");
            fillPhotoSvgCircle.setAttribute("cx", "50");
            fillPhotoSvgCircle.setAttribute("cy", "35");
            fillPhotoSvgCircle.setAttribute("r", "10");
            fillPhotoSvgG.append(fillPhotoSvgCircle);
            symbolSvg.append(fillPhotoSvgG);
            break;

        case "acrylicStand":
            const acrylicStandSvgG = document.createElementNS(SVG_NS, "g");
            acrylicStandSvgG.classList.add("symbol-svg");
            acrylicStandSvgG.setAttribute("fill", "none");
            acrylicStandSvgG.setAttribute("stroke", "currentColor");
            acrylicStandSvgG.setAttribute("stroke-width", "2");
            const acrylicStandSvgPath = document.createElementNS(SVG_NS, "path");
            acrylicStandSvgPath.setAttribute("d" , "M 42.5 80 Q 40 80, 40 77.5 V 65 Q 40 62.5, 37.5 62.5 Q 35 62.5, 35 60 V 42.5 Q 35 40, 37.5 40 H 62.5 Q 65 40, 65 42.5 V 60 Q 65 62.5, 62.5 62.5 Q 60 62.5, 60 65 V 77.5 Q 60 80, 57.5 80 Z");
            acrylicStandSvgG.append(acrylicStandSvgPath);
            const acrylicStandSvgCircle = document.createElementNS(SVG_NS, "circle");
            acrylicStandSvgCircle.setAttribute("cx", "50");
            acrylicStandSvgCircle.setAttribute("cy", "30");
            acrylicStandSvgCircle.setAttribute("r", "7");
            acrylicStandSvgG.append(acrylicStandSvgCircle);
            symbolSvg.append(acrylicStandSvgG);
            const fillAcrylicStandSvgG = document.createElementNS(SVG_NS, "g");
            fillAcrylicStandSvgG.classList.add("fill-symbol-svg");
            fillAcrylicStandSvgG.setAttribute("fill", "currentColor");
            const fillAcrylicStandSvgPath = document.createElementNS(SVG_NS, "path");
            fillAcrylicStandSvgPath.setAttribute("d", "M 30 80 A 4 1 0 0 1 70 80 A 4 1 0 0 1 30 80 Z");
            fillAcrylicStandSvgG.append(fillAcrylicStandSvgPath);
            symbolSvg.append(fillAcrylicStandSvgG);
            break;

        case "uchiwa":
            const uchiwaSvgG = document.createElementNS(SVG_NS, "g");
            uchiwaSvgG.classList.add("symbol-svg");
            uchiwaSvgG.setAttribute("fill", "none");
            uchiwaSvgG.setAttribute("stroke", "currentColor");
            uchiwaSvgG.setAttribute("stroke-width", "2");
            const uchiwaSvgPath = document.createElementNS(SVG_NS, "path");
            uchiwaSvgPath.setAttribute("d", "M 30 40 C 10 10, 90 10, 70 40 Q 50 70, 30 40 M 47 55 V 75 A 1 1 0 0 0 53 75 V 55");
            uchiwaSvgG.append(uchiwaSvgPath);
            symbolSvg.append(uchiwaSvgG);
            const fillUchiwaSvgG = document.createElementNS(SVG_NS, "g");
            fillUchiwaSvgG.classList.add("fill-symbol-svg");
            fillUchiwaSvgG.setAttribute("fill", "currentColor");
            const fillUchiwaSvgPath = document.createElementNS(SVG_NS, "path");
            fillUchiwaSvgPath.setAttribute("d", "M 50 50 L 40 40 A 1 1 0 0 1 50 30 A 1 1 0 0 1 60 40 Z");
            fillUchiwaSvgG.append(fillUchiwaSvgPath);
            symbolSvg.append(fillUchiwaSvgG);
            break;

        case "keyRing":
            const keyRingSvgG = document.createElementNS(SVG_NS, "g");
            keyRingSvgG.classList.add("symbol-svg");
            keyRingSvgG.setAttribute("fill", "none");
            keyRingSvgG.setAttribute("stroke", "currentColor");
            keyRingSvgG.setAttribute("stroke-width", "2");
            const keyRingSvgPath = document.createElementNS(SVG_NS, "path");
            keyRingSvgPath.setAttribute("d", "M 47.5 35 V 15 A 1 1 0 0 1 52.5 15 V 35 A 1 1 0 0 1 47.5 35 Z M 50 85 L 30 65 A 1 1 0 0 1 50 45 A 1 1 0 0 1 70 65 Z");
            keyRingSvgG.append(keyRingSvgPath);
            const keyRingSvgCircle = document.createElementNS(SVG_NS, "circle");
            keyRingSvgCircle.setAttribute("cx", "50");
            keyRingSvgCircle.setAttribute("cy", "39");
            keyRingSvgCircle.setAttribute("r", "4");
            keyRingSvgG.append(keyRingSvgCircle);
            symbolSvg.append(keyRingSvgG);
            break;

        case "penlight":
            const penlightSvgG = document.createElementNS(SVG_NS, "g");
            penlightSvgG.classList.add("symbol-svg");
            penlightSvgG.setAttribute("fill", "none");
            penlightSvgG.setAttribute("stroke", "currentColor");
            penlightSvgG.setAttribute("stroke-width", "2");
            const penlightSvgRect = document.createElementNS(SVG_NS, "rect");
            penlightSvgRect.setAttribute("x", "45");
            penlightSvgRect.setAttribute("y", "10");
            penlightSvgRect.setAttribute("width", "10");
            penlightSvgRect.setAttribute("height", "50");
            penlightSvgG.append(penlightSvgRect);
            const penlightSvgPath = document.createElementNS(SVG_NS, "path");
            penlightSvgPath.setAttribute("d", "M 40 25 L 30 15 M 40 35 H 25 M 40 45 L 30 55 M 60 25 L 70 15 M 60 35 H 75 M 60 45 L 70 55");
            penlightSvgG.append(penlightSvgPath);
            symbolSvg.append(penlightSvgG);
            const fillPenlightSvgG = document.createElementNS(SVG_NS, "g");
            fillPenlightSvgG.classList.add("fill-symbol-svg");
            fillPenlightSvgG.setAttribute("fill", "currentColor");
            fillPenlightSvgG.setAttribute("stroke", "none");
            const fillPenlightSvgRect = document.createElementNS(SVG_NS, "rect");
            fillPenlightSvgRect.setAttribute("x", "43.5");
            fillPenlightSvgRect.setAttribute("y", "60");
            fillPenlightSvgRect.setAttribute("width", "13");
            fillPenlightSvgRect.setAttribute("height", "30");
            fillPenlightSvgG.append(fillPenlightSvgRect);
            symbolSvg.append(fillPenlightSvgG);
            break;

        case "towel":
            const towelSvgG = document.createElementNS(SVG_NS, "g");
            towelSvgG.classList.add("symbol-svg");
            towelSvgG.setAttribute("fill", "none");
            towelSvgG.setAttribute("stroke", "currentColor");
            towelSvgG.setAttribute("stroke-width", "2");
            const towelSvgPath = document.createElementNS(SVG_NS, "path");
            towelSvgPath.setAttribute("d", "M 25 25 L 85 45 L 75 75 L 15 55 Z");
            towelSvgG.append(towelSvgPath);
            symbolSvg.append(towelSvgG);
            const fillTowelSvgG = document.createElementNS(SVG_NS, "g");
            fillTowelSvgG.classList.add("fill-symbol-svg");
            fillTowelSvgG.setAttribute("fill", "currentColor");
            fillTowelSvgG.setAttribute("stroke", "none");
            const fillTowelSvgPath = document.createElementNS(SVG_NS, "path");
            fillTowelSvgPath.setAttribute("d", "M 33 61 A 1 1 0 0 1 57 69 Z M 15 55 L 25 25 L 31 27 L 21 57 Z M 85 45 L 75 75 L 69 73 L 79 43 Z");
            fillTowelSvgG.append(fillTowelSvgPath);
            const fillTowelCircle = document.createElementNS(SVG_NS, "circle");
            fillTowelCircle.setAttribute("cx", "52");
            fillTowelCircle.setAttribute("cy", "44");
            fillTowelCircle.setAttribute("r", "6");
            fillTowelSvgG.append(fillTowelCircle);
            symbolSvg.append(fillTowelSvgG);
            break;

        case "badge":
            const badgeSvgG = document.createElementNS(SVG_NS, "g");
            badgeSvgG.classList.add("symbol-svg");
            badgeSvgG.setAttribute("fill", "none");
            badgeSvgG.setAttribute("stroke", "currentColor");
            badgeSvgG.setAttribute("stroke-width", "2");
            const badgeSvgPath = document.createElementNS(SVG_NS, "path");
            //badgeSvgPath.setAttribute("d", "M 50 75 L 25 50 A 1 1 0 0 1 50 25 A 1 1 0 0 1 75 50 Z M 35 60 Q 30 60, 25 65 T 15 70 H 10 L 15 75 L 10 80 H 15 Q 20 80, 25 75 T 40 65 M 65 60 Q 70 60, 75 65 T 85 70 H 90 L 85 75 L 90 80 H 85 Q 80 80, 75 75 T 60 65");
            badgeSvgPath.setAttribute("d", "M 35 60 Q 30 60, 25 65 T 15 70 H 10 L 15 75 L 10 80 H 15 Q 20 80, 25 75 T 40 65 M 65 60 Q 70 60, 75 65 T 85 70 H 90 L 85 75 L 90 80 H 85 Q 80 80, 75 75 T 60 65");
            badgeSvgG.append(badgeSvgPath);
            symbolSvg.append(badgeSvgG);
            const fillBadgeSvgG = document.createElementNS(SVG_NS, "g");
            fillBadgeSvgG.classList.add("fill-symbol-svg");
            fillBadgeSvgG.setAttribute("fill", "currentColor");
            const fillBadgeSvgPath = document.createElementNS(SVG_NS, "path");
            fillBadgeSvgPath.setAttribute("d", "M 50 75 L 25 50 A 1 1 0 0 1 50 25 A 1 1 0 0 1 75 50 Z");
            fillBadgeSvgG.append(fillBadgeSvgPath);
            symbolSvg.append(fillBadgeSvgG);
            break;

        case "bag":
            const bagSvgG = document.createElementNS(SVG_NS, "g");
            bagSvgG.classList.add("symbol-svg");
            bagSvgG.setAttribute("fill", "none");
            bagSvgG.setAttribute("stroke", "currentColor");
            bagSvgG.setAttribute("stroke-width", "2");
            const bagSvgPath = document.createElementNS(SVG_NS, "path");
            bagSvgPath.setAttribute("d", "M 30 30 A 1 1 0 0 1 70 30 H 65 A 1 1 0 0 0 35 30 Z M 20 30 H 80 V 90 H 20 Z M 50 75 L 35 60 A 1 1 0 0 1 50 45 A 1 1 0 0 1 65 60 Z");
            bagSvgG.append(bagSvgPath);
            symbolSvg.append(bagSvgG);
            break;

        case "pouch":
            const pouchSvgG = document.createElementNS(SVG_NS, "g");
            pouchSvgG.classList.add("symbol-svg");
            pouchSvgG.setAttribute("fill", "none");
            pouchSvgG.setAttribute("stroke", "currentColor");
            pouchSvgG.setAttribute("stroke-width", "2");
            const pouchSvgPath = document.createElementNS(SVG_NS, "path");
            pouchSvgPath.setAttribute("d", "M 75 40 V 80 H 25 V 40 H 32.5 M 57.5 40 H 62.5 M 25 45 H 75 M 50 75 L 40 65 A 1 1 0 0 1 50 55 A 1 1 0 0 1 60 65 Z M 35 45 L 25 25 L 45 15 L 60 45 M 60 45 L 65 35 L 75 40 L 72.5 45");
            pouchSvgG.append(pouchSvgPath);
            symbolSvg.append(pouchSvgG);
            const fillPouchSvgG = document.createElementNS(SVG_NS, "g");
            fillPouchSvgG.classList.add("fill-symbol-svg");
            fillPouchSvgG.setAttribute("fill", "currentColor");
            const fillPouchSvgPath = document.createElementNS(SVG_NS, "path");
            fillPouchSvgPath.setAttribute("d", "M 64 34.5 L 74 14.5 L 86 20.5 L 76 40.5 Z");
            fillPouchSvgG.append(fillPouchSvgPath);
            symbolSvg.append(fillPouchSvgG);
            break;

        default:
            const defaultSvgG = document.createElementNS(SVG_NS, "g");
            defaultSvgG.classList.add("symbol-svg");
            defaultSvgG.setAttribute("fill", "none");
            defaultSvgG.setAttribute("stroke", "currentColor");
            defaultSvgG.setAttribute("stroke-width", "2");
            const defaultSvgPath = document.createElementNS(SVG_NS, "path");
            defaultSvgPath.setAttribute("d", "M 20 35 Q 20 30, 25 30 H 40 Q 40 25, 45 25 H 55 Q 60 25, 60 30 H 75 Q 80 30, 80 35 V 65 Q 80 70, 75 70 H 25 Q 20 70, 20 65 Z M 80 20 L 20 80");
            defaultSvgG.append(defaultSvgPath);
            const defaultSvgCircle = document.createElementNS(SVG_NS, "circle");
            defaultSvgCircle.setAttribute("cx", "50");
            defaultSvgCircle.setAttribute("cy", "50");
            defaultSvgCircle.setAttribute("r", "10");
            defaultSvgG.append(defaultSvgCircle);
            symbolSvg.append(defaultSvgG);
            break;
    }
    return symbolSvg;
}