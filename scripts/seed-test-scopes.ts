#!/usr/bin/env tsx
/**
 * Seed fake SOW documents in Google Drive for testing.
 *
 * Copies the SOW template into a "Test Scopes" subfolder and replaces
 * placeholder text with fake project data. Documents are clearly marked
 * as test data in the title and body.
 *
 * Usage:
 *   tsx scripts/seed-test-scopes.ts
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CREDENTIALS_PATH = resolve(__dirname, '../credentials/kebo-mcp-sources-12c5559e4e03.json');
const SHARED_DRIVE_ID = '0ACcvqajavMiEUk9PVA';
const TEMPLATE_FILE_ID = '1ROPUlWf27LJEF_E7gnmon4u5xqt0w5lWMLlQpLW2rGQ';
const TEST_FOLDER_NAME = 'Test Scopes';

interface FakeScope {
  projectName: string;
  companyName: string;
  industry: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  salesName: string;
  date: string;
  description: string;
  technologies: string[];
  budget: string;
  timeline: string;
}

const FAKE_SCOPES: FakeScope[] = [
  {
    projectName: 'Digital Transformation Portal',
    companyName: 'Acme Manufacturing Co.',
    industry: 'Manufacturing',
    contactName: 'Sandra Ortega',
    contactEmail: 'sortega@acmemfg.example.com',
    contactPhone: '816-555-0142',
    salesName: 'Jordan Reeves',
    date: 'February 3, 2025',
    description:
      'Modernize a legacy ERP integration layer with a cloud-native API gateway and React-based operator dashboard. Keyhole will deliver a new data pipeline from on-prem SCADA systems to AWS, plus a real-time dashboard for plant floor operators.',
    technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS ECS', 'Terraform'],
    budget: '$240,000',
    timeline: '6 months',
  },
  {
    projectName: 'Patient Analytics Dashboard',
    companyName: 'TechFlow Health Systems',
    industry: 'Healthcare',
    contactName: 'Dr. Marcus Webb',
    contactEmail: 'mwebb@techflowhealth.example.com',
    contactPhone: '913-555-0278',
    salesName: 'Priya Nair',
    date: 'April 11, 2025',
    description:
      'Build a clinical outcomes analytics platform that ingests HL7 FHIR data from three hospital EMR systems and surfaces actionable insights to nursing and administrative staff via a secure web portal.',
    technologies: ['Python', 'FastAPI', 'Snowflake', 'Azure', 'Power BI Embedded'],
    budget: '$175,000',
    timeline: '4 months',
  },
  {
    projectName: 'Loan Origination Automation',
    companyName: 'Bridgeport Financial Group',
    industry: 'Financial Services',
    contactName: 'Teresa Hamlin',
    contactEmail: 'thamlin@bridgeportfg.example.com',
    contactPhone: '312-555-0391',
    salesName: 'Jordan Reeves',
    date: 'July 22, 2025',
    description:
      'Automate the end-to-end consumer loan origination workflow by replacing a paper-based approval process with a BPMN workflow engine, reducing time-to-decision from 5 business days to under 4 hours.',
    technologies: ['Java', 'Spring Boot', 'PostgreSQL', 'Camunda BPM', 'GCP Cloud Run'],
    budget: '$320,000',
    timeline: '8 months',
  },
  {
    projectName: 'Inventory Optimization Engine',
    companyName: 'RetailPlex Inc.',
    industry: 'Retail / E-Commerce',
    contactName: 'Kevin Ashford',
    contactEmail: 'kashford@retailplex.example.com',
    contactPhone: '720-555-0517',
    salesName: 'Priya Nair',
    date: 'September 5, 2025',
    description:
      'Implement a real-time inventory forecasting service that integrates POS data from 120 retail locations with supplier inventory APIs to reduce stockouts by an estimated 35%.',
    technologies: ['Python', 'Apache Kafka', 'Elasticsearch', 'AWS Lambda', 'Next.js'],
    budget: '$145,000',
    timeline: '5 months',
  },
  {
    projectName: 'Permit Management Modernization',
    companyName: 'CivicBridge Municipal Services',
    industry: 'Government / Public Sector',
    contactName: 'Diane Kowalski',
    contactEmail: 'dkowalski@civicbridge.example.gov',
    contactPhone: '405-555-0663',
    salesName: 'Jordan Reeves',
    date: 'November 14, 2025',
    description:
      'Replace a 15-year-old permitting system with a citizen-facing web portal, an internal staff workflow engine, and integration with the county GIS layer for parcel-level tracking.',
    technologies: ['Vue.js', '.NET 8', 'SQL Server', 'Azure App Service', 'ArcGIS REST API'],
    budget: '$290,000',
    timeline: '9 months',
  },
  {
    projectName: 'Fleet Telematics Platform',
    companyName: 'Horizon Logistics LLC',
    industry: 'Transportation & Logistics',
    contactName: 'Ray Thornton',
    contactEmail: 'rthornton@horizonlogistics.example.com',
    contactPhone: '214-555-0784',
    salesName: 'Priya Nair',
    date: 'January 9, 2026',
    description:
      'Design and build a telematics data platform that collects GPS and CAN-bus data from 800 long-haul trucks, processes events in near-real time, and exposes a driver-facing mobile app and dispatcher web console.',
    technologies: ['React Native', 'Go', 'TimescaleDB', 'Kafka', 'AWS IoT Core'],
    budget: '$410,000',
    timeline: '10 months',
  },
];

async function getOrCreateFolder(
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId: string,
): Promise<string> {
  const res = await drive.files.list({
    q: `name = '${name}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    corpora: 'drive',
    driveId: SHARED_DRIVE_ID,
    fields: 'files(id)',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  const folder = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return folder.data.id!;
}

async function main() {
  const key = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf-8'));

  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
    ],
  });

  const drive = google.drive({ version: 'v3', auth });
  const docs = google.docs({ version: 'v1', auth });

  // Ensure Test Scopes folder exists
  process.stdout.write(`Locating "${TEST_FOLDER_NAME}" folder ... `);
  const testFolderId = await getOrCreateFolder(drive, TEST_FOLDER_NAME, SHARED_DRIVE_ID);
  console.log(`ready (${testFolderId})`);

  const created: string[] = [];

  for (const scope of FAKE_SCOPES) {
    const title = `[TEST] ${scope.companyName} – ${scope.projectName}`;
    process.stdout.write(`  Creating "${title}" ... `);

    // Copy template into Test Scopes folder
    const copy = await drive.files.copy({
      fileId: TEMPLATE_FILE_ID,
      supportsAllDrives: true,
      requestBody: {
        name: title,
        parents: [testFolderId],
      },
      fields: 'id',
    });

    const docId = copy.data.id!;

    // Replace all placeholder text with fake data
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          { replaceAllText: { containsText: { text: 'Project Name', matchCase: true }, replaceText: scope.projectName } },
          { replaceAllText: { containsText: { text: 'CompanyName', matchCase: true }, replaceText: scope.companyName } },
          { replaceAllText: { containsText: { text: 'October 15, 2020', matchCase: false }, replaceText: scope.date } },
          { replaceAllText: { containsText: { text: 'Client Contact', matchCase: true }, replaceText: scope.contactName } },
          { replaceAllText: { containsText: { text: 'Sales Name', matchCase: true }, replaceText: scope.salesName } },
        ],
      },
    });

    const url = `https://docs.google.com/document/d/${docId}`;
    console.log(`done\n    → ${url}`);
    created.push(url);
  }

  console.log(`\nCreated ${created.length} test SOW documents in "${TEST_FOLDER_NAME}":`);
  console.log(`  https://drive.google.com/drive/folders/${testFolderId}`);
}

main().catch((err) => {
  console.error('\nFailed:', err.message ?? err);
  process.exit(1);
});
