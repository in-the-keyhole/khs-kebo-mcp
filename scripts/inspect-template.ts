import { google } from 'googleapis';
import { readFileSync } from 'fs';

const KEY_PATH = './credentials/kebo-mcp-sources-12c5559e4e03.json';
const TEMPLATE_ID = '1ROPUlWf27LJEF_E7gnmon4u5xqt0w5lWMLlQpLW2rGQ';

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(KEY_PATH, 'utf-8')),
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/documents'],
  });
  const authClient = await auth.getClient();
  const docs = google.docs({ version: 'v1', auth: authClient as never });
  const drive = google.drive({ version: 'v3', auth: authClient as never });

  // List all files visible to the service account across all drives
  const list = await drive.files.list({
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'allDrives',
    fields: 'files(id,name,parents,driveId)',
    pageSize: 50,
  });
  console.log('All visible files:');
  for (const f of list.data.files ?? []) {
    console.log(`  ${f.name} (${f.id}) driveId=${f.driveId}`);
  }

  // Try direct access to template
  console.log('\nTrying direct template access...');
  try {
    const meta = await drive.files.get({
      fileId: TEMPLATE_ID,
      supportsAllDrives: true,
      fields: 'id,name',
    });
    console.log('Template visible:', meta.data.name);

    // Export and inspect
    const exported = await drive.files.export(
      { fileId: TEMPLATE_ID, mimeType: 'text/plain' },
      { responseType: 'text' },
    );
    console.log('\n=== TEMPLATE TEXT (first 3000 chars) ===');
    console.log(String(exported.data).slice(0, 3000));

    const doc = await docs.documents.get({ documentId: TEMPLATE_ID });
    const body = doc.data.body?.content ?? [];
    const lastEl = body[body.length - 1];
    console.log('\nBody end index:', lastEl?.endIndex);
  } catch (e: unknown) {
    console.log('Template not accessible:', (e as Error).message);
  }
}

main().catch(console.error);
