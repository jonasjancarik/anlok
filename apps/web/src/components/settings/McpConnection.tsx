import { useState } from 'react';
import { Alert, Button, Card, Form, InputGroup } from 'react-bootstrap';

const McpConnection = () => {
    const [copied, setCopied] = useState(false);
    const mcpUrl = process.env.NEXT_PUBLIC_MCP_URL
        || `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')}/mcp`;

    const copyUrl = async () => {
        await navigator.clipboard.writeText(mcpUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="border-0 shadow-sm" style={{ maxWidth: '46rem' }}>
            <Card.Body className="p-4">
                <h3 className="h5">Connect an AI assistant</h3>
                <p className="text-body-secondary">
                    Add this address to a compatible MCP client. Your browser will open so you can sign in with
                    your Anlok email and approve the connection. The assistant receives only the access your Anlok
                    account already has.
                </p>
                <Form.Label htmlFor="mcp-url">MCP server address</Form.Label>
                <InputGroup>
                    <Form.Control id="mcp-url" value={mcpUrl} readOnly aria-label="MCP server address" />
                    <Button variant="outline-secondary" onClick={copyUrl}>
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                </InputGroup>
                <Alert variant="light" className="mt-3 mb-0 small">
                    You do not need to create or paste an API key. The client stores its own short-lived connection
                    securely and can ask you to sign in again when needed.
                </Alert>
            </Card.Body>
        </Card>
    );
};

export default McpConnection;
