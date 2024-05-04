// You don't really need to bother with this
// You can just use `/https:\/\/github\.com\/(?<repo>[\w-]+(?:\/[\w-]+)*?)\/blob\/(?<path>[^#\s]+)#L(?<first_line>\d+)(?:-L(?<second_line>\d+))?/i` instead
export function matchGithubURL(text: string): { repository: string, path: string, first_line: string, final_line: string, index: number, lastIndex: number } | null {
    if (!text.includes("github.com")) return null;

    let loop = true;

    let repository!: string;
    let path!: string;
    let first_line!: string;
    let final_line!: string;

    let firstIndex = text.indexOf("h");
    let lastIndex = 0;

    do {
        if (firstIndex === -1) return null;
        if (text[firstIndex + 1] !== "t") {
            firstIndex = text.indexOf("h", firstIndex + 1);
            continue;
        }
        if (text[firstIndex + 2] !== "t") {
            firstIndex = text.indexOf("h", firstIndex + 2);
            continue;
        }
        if (text[firstIndex + 3] !== "p") {
            firstIndex = text.indexOf("h", firstIndex + 3);
            continue;
        }
        if (text[firstIndex + 4] !== "s" && text[firstIndex + 4] !== ":") {
            firstIndex = text.indexOf("h", firstIndex + 4);
            continue;
        }

        const skip = firstIndex + 4 + (text[firstIndex + 4] === "s" ? 4 : 3);
        const domainEnd = text.indexOf("/", skip);
        const matchedDomain = text.slice(skip, domainEnd);
        if (matchedDomain !== "github.com") {
            firstIndex = text.indexOf("h", domainEnd);
            continue;
        }

        const ownerIndex = text.indexOf("/", domainEnd + 1);
        const repoIndex = text.indexOf("/", ownerIndex + 1);

        repository = text.slice(domainEnd + 1, repoIndex);

        // We need to skip `blob`
        const pathStart = repoIndex + (text[repoIndex + 1] === "b" && text[repoIndex + 2] === "l" && text[repoIndex + 3] === "o" && text[repoIndex + 4] === "b" ? 6 : 1);

        const extensionIndex = text.indexOf(".", pathStart);

        const lineIndex = text[extensionIndex + 1] === "#"
            ? extensionIndex + 1
            : text[extensionIndex + 2] === "#"
                ? extensionIndex + 2
                : text[extensionIndex + 3] === "#"
                    ? extensionIndex + 3
                    : text[extensionIndex + 4] === "#"
                        ? extensionIndex + 4
                        : text[extensionIndex + 5] === "#"
                            ? extensionIndex + 5
                            : -1;

        if (lineIndex === -1) {
            firstIndex = text.indexOf("h", extensionIndex);
            continue;
        }

        path = text.slice(pathStart, lineIndex);

        let i = lineIndex + 2;
        let lineNum = "";
        while (!isNaN(+text[i])) lineNum += text[i++];

        first_line = lineNum;

        if (text[i] !== "-") {
            final_line = first_line;
            lastIndex = i - 1;
            loop = false;
            break;
        }

        i += 2;
        lineNum = "";
        while (!isNaN(+text[i])) lineNum += text[i++];
        final_line = lineNum;
        lastIndex = i - 1;

        loop = false;
        break;
    } while (loop);

    return { repository, path, first_line, final_line, index: firstIndex, lastIndex };
}
