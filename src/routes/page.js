import fs from 'fs';
import npath from 'path';

export default async (_req, res, path) => {
    try {
        let normalizedPath = path;
        while (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
            normalizedPath = normalizedPath.slice(0, -1);
        }

        const joinMatch = normalizedPath.match(/^\/join(?:\/([^/]+))?$/);
        if (!joinMatch) return res.redirect('/join');

        let joinCode;
        if (joinMatch[1]) {
            try {
                joinCode = decodeURIComponent(joinMatch[1]);
            } catch {
                joinCode = joinMatch[1];
            }
        }

        const response = await fetch(`https://www.gimkit.com/join`);
        let html = await response.text();

        ['content-type', 'set-cookie'].forEach((header) => {
            if (response.headers.has(header))
                res.setHeader(header, response.headers.get(header));
        });

        const bundleScript = `<script>${fs.readFileSync(npath.join(import.meta.dirname, '..', 'bundle.txt'), 'utf-8')}</script>`;
        const joinScript = joinCode ? `
        <script>
            (() => {
                const code = ${JSON.stringify(joinCode)};
                if (!code) return;

                let retries = 0;

                const fillInput = () => {
                    retries += 1;
                    const selectors = [
                        'input[placeholder*="code" i]',
                        'input[name*="code" i]',
                        'input[aria-label*="code" i]',
                        'input[type="text"]'
                    ];
                    let input;
                    for (const selector of selectors) {
                        input = document.querySelector(selector);
                        if (input) break;
                    }
                    input ||= document.querySelector('input[type="text"]');
                    if (!input || retries > 40) return setTimeout(fillInput, 250);

                    input.focus();
                    const valueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
                    if (valueSetter) {
                        valueSetter.call(input, code);
                    } else {
                        input.value = code;
                    }
                    input.dispatchEvent(new Event('input', { bubbles: true }));

                    const joinButton = Array.from(document.querySelectorAll('button')).find((button) =>
                        /join/i.test(button.textContent ?? '')
                    );
                    if (!joinButton && retries < 40) {
                        return setTimeout(fillInput, 250);
                    }

                    joinButton?.click();
                };

                window.addEventListener('load', () => setTimeout(fillInput, 250));
                setTimeout(fillInput, 250);
            })();
        </script>` : '';

        html = html.replace(
            `<head>`,
            `<head>
            ${bundleScript}
            ${joinScript}`
        );

        html = html.replace(
            `content="https://www.gimkit.com">`,
            `content="https://www.gimkit.com"><script>document.querySelector('meta[property="cdn-map-assets-url"]').content = location.origin</script>`
        );

        res.send(html);
    } catch (e) {
        console.error(e, path);
    }
};