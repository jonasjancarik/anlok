import React, { useState } from 'react';
import { Nav } from 'react-bootstrap';

type GuideKey = 'iphone' | 'android' | 'home-assistant';

interface UnlockShortcutGuideProps {
    serverUrl: string;
    apiKey?: string | null;
}

const Code = ({ children }: { children: string }) => (
    <pre className="bg-light border rounded p-2 small mb-2" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {children}
    </pre>
);

const UnlockShortcutGuide: React.FC<UnlockShortcutGuideProps> = ({ serverUrl, apiKey }) => {
    const [guide, setGuide] = useState<GuideKey>('iphone');
    const unlockUrl = `${(serverUrl || 'https://your-anlok-server').replace(/\/+$/, '')}/doors/unlock`;
    const key = apiKey || 'YOUR_API_KEY';

    return (
        <div>
            <h6 className="fw-bold mb-1">Open the door with one tap</h6>
            <p className="text-muted small">
                Use a key that can only open the door. If the phone or device is lost, delete the key here and
                nothing else is affected.
            </p>

            <Nav variant="pills" activeKey={guide} onSelect={(next) => next && setGuide(next as GuideKey)} className="mb-3 small">
                <Nav.Item><Nav.Link eventKey="iphone">iPhone</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="android">Android</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="home-assistant">Home Assistant</Nav.Link></Nav.Item>
            </Nav>

            {guide === 'iphone' && (
                <ol className="small ps-3">
                    <li className="mb-2">
                        Open the <strong>Shortcuts</strong> app, tap <strong>+</strong> and add the{' '}
                        <strong>Get Contents of URL</strong> action.
                    </li>
                    <li className="mb-2">
                        Set the URL to:
                        <Code>{unlockUrl}</Code>
                    </li>
                    <li className="mb-2">
                        Tap the arrow next to the URL. Change <strong>Method</strong> to <strong>POST</strong>, then
                        add a header named <strong>X-API-Key</strong> with your key as the value:
                        <Code>{key}</Code>
                    </li>
                    <li>
                        Name the shortcut, for example &ldquo;Open the door&rdquo;. Now you can say &ldquo;Hey Siri,
                        open the door&rdquo;, add it to your Home Screen, or put it on the Action Button or in Control
                        Center.
                    </li>
                </ol>
            )}

            {guide === 'android' && (
                <ol className="small ps-3">
                    <li className="mb-2">
                        Install the free <strong>HTTP Shortcuts</strong> app from Google Play and create a new regular
                        shortcut.
                    </li>
                    <li className="mb-2">
                        Set <strong>Method</strong> to <strong>POST</strong> and the URL to:
                        <Code>{unlockUrl}</Code>
                    </li>
                    <li className="mb-2">
                        Under <strong>Request Headers</strong>, add <strong>X-API-Key</strong> with your key as the
                        value:
                        <Code>{key}</Code>
                    </li>
                    <li>Save it, then place it on your home screen as an icon or widget. One tap opens the door.</li>
                </ol>
            )}

            {guide === 'home-assistant' && (
                <ol className="small ps-3">
                    <li className="mb-2">
                        Add the key to <strong>secrets.yaml</strong>:
                        <Code>{`anlok_api_key: "${key}"`}</Code>
                    </li>
                    <li className="mb-2">
                        Add this to <strong>configuration.yaml</strong> and restart Home Assistant:
                        <Code>
                            {`rest_command:\n  anlok_unlock:\n    url: "${unlockUrl}"\n    method: post\n    headers:\n      X-API-Key: !secret anlok_api_key`}
                        </Code>
                    </li>
                    <li>
                        Use the <strong>rest_command.anlok_unlock</strong> action in a script, automation or dashboard
                        button. If you share that script with Google Home, Alexa or Apple Home, you can open the door
                        from there too.
                    </li>
                </ol>
            )}
        </div>
    );
};

export default UnlockShortcutGuide;
