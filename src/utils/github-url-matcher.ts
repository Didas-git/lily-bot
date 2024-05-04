// You don't really need to bother with this
// You can just use `/https:\/\/github\.com\/(?<repo>[\w-]+(?:\/[\w-]+)*?)\/blob\/(?<path>[^#\s]+)#L(?<first_line>\d+)(?:-L(?<second_line>\d+))?/i` instead
export function matchGithubURL(text: string): { repository: string, path: string, firstLine: string, finalLine: string, index: number, lastIndex: number } | null {
    let repository!: string;
    let path!: string;
    let firstLine!: string;
    let finalLine!: string;

    let firstGitIndex = text.indexOf("github.com");
    let lastIndex = 0;

    do {
        if (firstGitIndex === -1) return null;
        firstGitIndex += 10;

        const ownerIndex = text.indexOf("/", firstGitIndex + 1);
        const repoIndex = text.indexOf("/", ownerIndex + 1);
        repository = text.slice(firstGitIndex + 1, repoIndex);

        const extensionIndex = text.indexOf(".", repoIndex + 6);

        const lineIndex = text.indexOf("#L", extensionIndex);
        if (lineIndex - extensionIndex > 5) {
            firstGitIndex = text.indexOf("github.com", extensionIndex);
            continue;
        }

        path = text.slice(repoIndex + 6, lineIndex);

        lastIndex = lineIndex + 2;
        let lineNum = "";
        while (!isNaN(+text[lastIndex])) lineNum += text[lastIndex++];

        firstLine = lineNum;

        if (text[lastIndex] !== "-") {
            finalLine = firstLine;
            lastIndex -= 1;
            break;
        }

        lastIndex += 2;
        lineNum = "";
        while (!isNaN(+text[lastIndex])) lineNum += text[lastIndex++];
        finalLine = lineNum;
        lastIndex -= 1;
        break;
    // eslint-disable-next-line no-constant-condition
    } while (true);

    return { repository, path, firstLine, finalLine, index: firstGitIndex, lastIndex };
}
