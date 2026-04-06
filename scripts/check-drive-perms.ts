import { google } from 'googleapis';
import { readFileSync } from 'fs';

const keyFile = JSON.parse(readFileSync('./credentials/kebo-mcp-sources-12c5559e4e03.json', 'utf-8'));
const FOLDER_ID = '1ZSW9ntIvdz-NATZQAX1n7DNlK4_QQNeZ';

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const drive = google.drive({ version: 'v3', auth: await auth.getClient() as never });

  // Check permissions on folder
  try {
    const perm = await drive.permissions.list({
      fileId: FOLDER_ID,
      fields: 'permissions(id,emailAddress,role,type)',
    });
    console.log('Folder permissions:', JSON.stringify(perm.data, null, 2));
  } catch (e: unknown) {
    console.log('permissions.list error:', (e as Error).message);
  }

  // Try to get folder metadata
  try {
    const meta = await drive.files.get({ fileId: FOLDER_ID, fields: 'id,name,capabilities' });
    console.log('Folder metadata:', JSON.stringify(meta.data, null, 2));
  } catch (e: unknown) {
    console.log('files.get error:', (e as Error).message);
  }

  // Try creating a file directly in the folder
  try {
    const test = await drive.files.create({
      requestBody: { name: '_permission_test', mimeType: 'application/vnd.google-apps.document', parents: [FOLDER_ID] },
      fields: 'id',
    });
    console.log('Test file created:', test.data.id);
    // Clean up
    await drive.files.delete({ fileId: test.data.id! });
    console.log('Test file deleted.');
  } catch (e: unknown) {
    console.log('files.create error:', (e as Error).message);
  }
}

main().catch(console.error);
