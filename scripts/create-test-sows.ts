/**
 * Creates rich test SOW documents in Google Drive by copying the SOW template
 * and replacing placeholder content with varied, realistic client engagements.
 *
 * Run with: npx tsx scripts/create-test-sows.ts
 */

import { google } from 'googleapis';
import { readFileSync } from 'fs';
import path from 'path';

const KEY_PATH = path.resolve('./credentials/kebo-mcp-sources-12c5559e4e03.json');
const FOLDER_ID = '1ZSW9ntIvdz-NATZQAX1n7DNlK4_QQNeZ';
const TEMPLATE_ID = '1ROPUlWf27LJEF_E7gnmon4u5xqt0w5lWMLlQpLW2rGQ';

interface SowDoc {
  title: string;
  projectName: string;
  clientName: string;
  contact: string;
  date: string;
  /** Body starting from "1. Scope of Services" — replaces the template placeholder body */
  body: string;
}

const TEST_SOWS: SowDoc[] = [
  {
    title: '[TEST] Apex Capital Markets – Real-Time Trading Dashboard',
    projectName: 'Real-Time Trading Dashboard',
    clientName: 'Apex Capital Markets',
    contact: 'Jordan Mercer, CTO',
    date: 'January 2026',
    body: `1. Scope of Services

Project Background
Apex Capital Markets is an early-stage algorithmic trading startup seeking to build a real-time portfolio analytics platform from the ground up. The platform must handle sub-second market data feeds from multiple exchanges and provide live risk calculations to traders.

Technical Requirements
The client has specified the following technology stack for this engagement:
- Frontend: React 18 with TypeScript, Zustand for state management, Recharts for financial chart rendering, WebSocket connections for live price feeds
- Backend: Node.js with NestJS framework, RESTful and WebSocket APIs
- Database: TimescaleDB (PostgreSQL time-series extension) for tick data; Redis for session caching and real-time pub/sub
- Cloud: AWS — ECS Fargate for containerized services, ElastiCache for Redis, RDS for TimescaleDB, API Gateway, CloudWatch
- Authentication: AWS Cognito with MFA enforcement per SEC compliance requirements
- Data feeds: IEX Cloud API for market data ingestion; Stripe API for subscription billing

Architecture Overview
A microservices architecture on AWS ECS Fargate. A dedicated ingestion service consumes WebSocket feeds from IEX Cloud and persists tick data into TimescaleDB. A portfolio calculation service runs risk metrics on demand. The React frontend connects directly to an API Gateway WebSocket endpoint for push notifications.

2. Deliverables
- React 18/TypeScript single-page application with live chart components
- NestJS API deployed to AWS ECS Fargate
- TimescaleDB schema with data retention policies
- Terraform-managed AWS infrastructure
- GitHub Actions CI/CD pipeline to AWS ECR/ECS
- Integration test suite (Jest + Supertest)

3. Estimated Schedule and Charges
Engagement type: Greenfield new build
Timeline: 14 weeks
Estimated hours: 480–560 hours
Hourly rate: $175/hr (Senior Engineer)
Estimated total investment: $84,000–$98,000`,
  },

  {
    title: '[TEST] Mercy Regional Health Network – EHR Integration Platform',
    projectName: 'EHR Integration Platform',
    clientName: 'Mercy Regional Health Network',
    contact: 'Dr. Patricia Holloway, VP of Technology',
    date: 'February 2026',
    body: `1. Scope of Services

Project Background
Mercy Regional Health Network operates 14 hospital facilities across three states. The engagement involves migrating a legacy .NET Framework 4.5 patient data exchange system to a modern cloud-based HL7 FHIR R4 integration platform hosted on Azure, to support interoperability with Epic EHR, state health information exchanges, and patient-facing applications.

Technical Requirements
- Migration source: .NET Framework 4.5, Windows Server 2012, SQL Server 2014, HL7 v2.x messages
- Target platform: .NET 8 (C#), Azure App Service, Azure Service Bus for async message routing
- Database: Azure SQL Managed Instance (migration from on-premise SQL Server 2014)
- FHIR layer: Microsoft Azure Health Data Services (FHIR Service), SMART on FHIR authorization
- Integration: Epic FHIR R4 APIs, CareQuality and CommonWell network adapters
- Identity: Azure Active Directory B2C with HIPAA-compliant audit logging
- Monitoring: Azure Monitor, Application Insights, compliance dashboards
- Infrastructure: Azure Kubernetes Service (AKS) for FHIR processing workers

HIPAA Compliance
All data at rest encrypted via Azure Storage Service Encryption. All data in transit via TLS 1.3. PHI access logging to Azure Monitor Log Analytics. Penetration testing required prior to go-live.

2. Deliverables
- .NET 8 FHIR R4 API service deployed to Azure App Service
- Azure Service Bus message routing for HL7 transformation pipeline
- AKS-hosted processing workers with autoscaling policies
- Azure SQL MI schema migration and data validation scripts
- Epic FHIR integration connector with certification documentation
- HIPAA audit logging dashboards in Azure Monitor
- Load and penetration testing reports

3. Estimated Schedule and Charges
Engagement type: Platform migration (legacy .NET Framework to Azure)
Timeline: 36 weeks
Estimated hours: 2,800–3,200 hours
Blended hourly rate: $185/hr
Estimated total investment: $518,000–$592,000`,
  },

  {
    title: '[TEST] FastFreight Logistics Co. – Route Optimization Engine',
    projectName: 'Route Optimization Engine',
    clientName: 'FastFreight Logistics Co.',
    contact: 'Marcus Chen, Director of Engineering',
    date: 'January 2026',
    body: `1. Scope of Services

Project Background
FastFreight operates a fleet of 320 vehicles across the Midwest and currently relies on manual dispatch and static routing software. The client requires a platform to ingest real-time GPS telemetry, weather, and traffic conditions, then compute and push optimized routes to drivers via a mobile app.

Technical Requirements
- Backend: Python 3.12, FastAPI for REST APIs; Celery with Redis for background optimization tasks
- Optimization: Google OR-Tools (vehicle routing problem solver); Google Maps Platform Distance Matrix API
- Database: PostgreSQL 16 with PostGIS extension for geospatial queries; Redis 7 for routing cache
- Cloud: Google Cloud Platform — Cloud Run for stateless API services, Cloud SQL for PostgreSQL, Pub/Sub for GPS telemetry ingestion, BigQuery for historical analytics, Cloud Scheduler for batch jobs
- Mobile: Flutter (Dart), cross-platform iOS/Android; route updates via Firebase Cloud Messaging
- Telemetry: Samsara Fleet API for real-time GPS and vehicle diagnostics
- Observability: Google Cloud Monitoring, Cloud Logging, Looker Studio dashboards

Architecture Overview
GPS events ingested via Cloud Pub/Sub and stored in Cloud SQL/PostGIS. A Celery worker on Cloud Run invokes OR-Tools every 15 minutes to recompute optimal routes for active vehicles. Route assignments pushed to the Flutter app via Firebase Cloud Messaging.

2. Deliverables
- Python/FastAPI backend deployed to GCP Cloud Run
- PostgreSQL/PostGIS schema with geospatial indexes
- OR-Tools routing solver with configurable constraints
- Flutter mobile app for iOS and Android
- BigQuery analytics dataset with Looker Studio dashboard
- Terraform-managed GCP infrastructure
- Samsara Fleet API integration

3. Estimated Schedule and Charges
Engagement type: Greenfield new platform
Timeline: 20 weeks
Estimated hours: 720–840 hours
Hourly rate: $170/hr
Estimated total investment: $122,400–$142,800`,
  },

  {
    title: '[TEST] Urban Threads Apparel – Mobile Commerce Platform',
    projectName: 'Mobile Commerce Platform',
    clientName: 'Urban Threads Apparel',
    contact: 'Ashley Kim, Head of Digital',
    date: 'March 2026',
    body: `1. Scope of Services

Project Background
Urban Threads is a mid-market direct-to-consumer fashion retailer seeking to launch a branded mobile shopping app for iOS and Android. The app must deeply integrate with their existing Shopify Plus storefront while adding AR try-on features, loyalty program management, and push-based personalized promotions.

Technical Requirements
- Mobile framework: React Native 0.74 with Expo SDK 51; TypeScript throughout
- AR try-on: Apple ARKit (iOS) and Google ARCore (Android) via Expo Camera and custom native modules
- E-commerce: Shopify Storefront GraphQL API for product catalog, cart, and checkout; Shopify Customer API for accounts
- State management: Zustand + React Query for server state caching
- Backend: Node.js/Express API on AWS Lambda (Serverless Framework) for loyalty points and promotions
- Database: DynamoDB for user preferences and loyalty ledger; S3 for 3D garment model assets
- Push notifications: AWS SNS + Expo Push Notification Service
- Analytics: Amplitude for behavior tracking; Segment as CDP

2. Deliverables
- React Native app published to Apple App Store and Google Play Store
- Node.js/Lambda loyalty and promotions API
- DynamoDB tables and access patterns
- Shopify Storefront GraphQL API integration layer
- AR camera overlay module (Phase 1: 2D overlay)
- AWS SNS push notification system
- Amplitude analytics instrumentation

3. Estimated Schedule and Charges
Engagement type: Greenfield mobile application
Timeline: 18 weeks
Estimated hours: 640–720 hours
Blended hourly rate: $175/hr
Estimated total investment: $112,000–$126,000`,
  },

  {
    title: '[TEST] State of Midvale DOR – Tax Portal Modernization',
    projectName: 'Tax Portal Modernization',
    clientName: 'State of Midvale Department of Revenue',
    contact: 'Commissioner Sandra Briggs',
    date: 'February 2026',
    body: `1. Scope of Services

Project Background
The Department of Revenue currently processes tax filings through a 1990s-era COBOL system on an IBM z/OS mainframe. The system must be modernized to support online filing, real-time validation, and integration with the IRS modernized e-file (MeF) system. Data sovereignty requirements mandate that all systems remain hosted in the State's own Tier 3 data center — no public cloud usage.

Technical Requirements
- Frontend: Angular 18 with TypeScript; WCAG 2.1 AA accessibility compliance; responsive design
- Backend: Java 21 with Spring Boot 3.3, Spring Security for OAuth2/OIDC; RESTful APIs per OpenAPI 3.1
- Database: Oracle Database 21c (existing State license); migration from COBOL flat files and VSAM; Flyway for schema migrations
- IRS integration: IRS MeF SOAP/XML API for e-filing submission; SFTP bulk transmission fallback
- Identity: On-premise Keycloak 24 (OIDC) integrated with State Active Directory via LDAP
- Infrastructure: On-premise VMware vSphere; Docker containers on OpenShift 4.14; no public cloud
- Security: NIST 800-53 High baseline; annual penetration testing; FedRAMP-equivalent controls
- Legacy migration: COBOL flat file ETL into Oracle 21c with validation and reconciliation

Architecture Overview
A strangler-fig migration pattern. New Angular filing flows run against Java Spring Boot microservices while COBOL remains live for historical record retrieval. Legacy data migrated in rolling batches validated against source before decommission.

2. Deliverables
- Angular 18 taxpayer portal with WCAG 2.1 AA certification
- Java Spring Boot microservices (filing, validation, payment, audit)
- Oracle 21c schema and Flyway migration scripts
- IRS MeF SOAP integration with retry and acknowledgment handling
- On-premise Keycloak OIDC with Active Directory integration
- OpenShift deployment manifests and Helm charts
- COBOL-to-Oracle ETL pipeline and reconciliation reports
- NIST 800-53 security controls documentation

3. Estimated Schedule and Charges
Engagement type: Legacy system modernization (migration)
Timeline: 52 weeks
Estimated hours: 4,800–5,600 hours
Blended hourly rate: $185/hr
Estimated total investment: $888,000–$1,036,000`,
  },

  {
    title: '[TEST] Precision Dynamics Corp. – IoT Manufacturing Intelligence',
    projectName: 'IoT Manufacturing Intelligence Platform',
    clientName: 'Precision Dynamics Corp.',
    contact: 'VP of Operations, Precision Dynamics Corp.',
    date: 'March 2026',
    body: `1. Scope of Services

Project Background
Precision Dynamics Corp. operates six precision parts manufacturing facilities. The engagement is a greenfield IoT platform to collect real-time sensor data from CNC machines and injection molding equipment, detect anomalies, and reduce unplanned downtime through predictive maintenance.

Technical Requirements
- IoT edge: Azure IoT Edge runtime on Linux gateways co-located in each facility; OPC-UA to Azure IoT Hub bridge
- Cloud: Microsoft Azure throughout — IoT Hub for device ingestion, Stream Analytics for real-time anomaly detection, Azure Digital Twins for facility/machine modeling, Time Series Insights for historian data
- Backend: C# .NET 8, Azure Functions for event-driven processing, Azure Service Bus for ERP integration events
- Database: Azure SQL for structured operational data; Azure Data Lake Storage Gen2 for raw telemetry; Azure Synapse Analytics for batch analytics
- ERP integration: SAP S/4HANA REST APIs via SAP Integration Suite for automated work order creation
- Visualization: Power BI Embedded in a React dashboard; real-time streaming datasets
- Machine learning: Azure Machine Learning with scikit-learn for predictive failure models trained on historical downtime data
- Security: Azure Defender for IoT; X.509 certificate-based device authentication

Architecture Overview
Each facility runs an Azure IoT Edge gateway translating OPC-UA machine signals to IoT Hub. Stream Analytics jobs evaluate real-time anomaly rules. Azure Digital Twins maintains a live model of each facility's asset hierarchy. Power BI Embedded dashboards surface KPIs to operations managers.

2. Deliverables
- Azure IoT Edge modules and OPC-UA bridge configuration
- Azure IoT Hub and Stream Analytics deployment
- C#/.NET 8 Azure Functions for event processing
- Azure Digital Twins facility ontology
- SAP S/4HANA integration for automated work orders
- Power BI Embedded React dashboard
- Azure Machine Learning predictive maintenance model (v1)
- Azure Bicep infrastructure templates

3. Estimated Schedule and Charges
Engagement type: Greenfield IoT platform
Timeline: 28 weeks
Estimated hours: 1,600–1,800 hours
Blended hourly rate: $190/hr
Estimated total investment: $304,000–$342,000`,
  },

  {
    title: '[TEST] DevMetrics Inc. – Platform Engineering Augmentation',
    projectName: 'Platform Engineering Augmentation',
    clientName: 'DevMetrics Inc.',
    contact: 'CTO, DevMetrics Inc.',
    date: 'January 2026',
    body: `1. Scope of Services

Project Background
DevMetrics Inc. is a B2B SaaS company providing developer productivity analytics to approximately 200 enterprise customers. Their Go monolith has reached scaling limits. Keyhole is engaged to augment the internal team of 8 engineers with 3 senior engineers to accelerate decomposition of the monolith into independently deployable microservices on Google Cloud Platform.

Technical Requirements (Existing Platform)
- Language: Go 1.22 throughout (existing codebase to be extended)
- Current deployment: single Go binary on GCE VM (migrating)
- Target deployment: Google Kubernetes Engine (GKE Autopilot) with Helm charts per service
- Service mesh: Istio for mTLS between services and traffic management
- API gateway: Kong Gateway on GKE for external API routing and rate limiting
- Databases: PostgreSQL 15 on Cloud SQL (existing); Redis 7 on Memorystore (existing); Cloud Bigtable for time-series metrics (new)
- Message bus: Google Cloud Pub/Sub for async event propagation between services
- Observability: OpenTelemetry instrumentation; Google Cloud Trace; Cloud Monitoring; Cloud Logging
- CI/CD: GitHub Actions pipelines extended with Cloud Deploy for progressive GKE rollouts

Augmentation Scope
Keyhole engineers embed with the client team, contributing directly to the existing Go codebase under the client's technical direction. Weekly progress syncs with the DevMetrics CTO.

2. Deliverables
- Decomposed Go microservices (scope defined sprint-by-sprint with client)
- GKE/Helm deployment manifests per service
- Istio service mesh configuration
- Cloud Bigtable schema for time-series metrics
- OpenTelemetry instrumentation across all touched services
- Updated GitHub Actions pipelines with Cloud Deploy stages

3. Estimated Schedule and Charges
Engagement type: Staff augmentation (embedded engineering)
Timeline: 24 weeks (renewable quarterly)
Team: 3 Senior Go/GCP Engineers at 40 hrs/week each
Estimated total investment: $168,000–$201,600`,
  },

  {
    title: '[TEST] StreamVault Media – Content Analytics Data Platform',
    projectName: 'Content Analytics Data Platform',
    clientName: 'StreamVault Media',
    contact: 'Chief Data Officer, StreamVault Media',
    date: 'February 2026',
    body: `1. Scope of Services

Project Background
StreamVault Media is a subscription video-on-demand platform with 4.2 million subscribers. The engagement is a greenfield data platform to replace ad-hoc queries against a shared Amazon Redshift cluster with a governed, scalable data mesh supporting content recommendation, churn prediction, and real-time viewership analytics.

Technical Requirements
- Streaming ingestion: Apache Kafka on AWS MSK for real-time viewership events (play, pause, complete, seek); producers are existing Java microservices
- Stream processing: Apache Flink on AWS EMR Serverless for real-time session aggregation and feature computation; output to Apache Iceberg tables on S3
- Batch processing: Apache Spark 3.5 on EMR Serverless for nightly ETL from RDS PostgreSQL (OLTP) and third-party data enrichment
- Data lakehouse: Apache Iceberg table format on S3; AWS Glue Data Catalog; dbt Core for SQL transformation models, tests, and documentation
- Data warehouse: Snowflake (replacing Redshift) — separate compute warehouses for BI, data science, and operational analytics
- Orchestration: Apache Airflow 2.9 on AWS MWAA for DAG management
- Feature store: AWS SageMaker Feature Store for ML feature serving (churn model, recommendation engine)
- ML serving: SageMaker endpoints for real-time recommendations consumed by existing Java microservices
- Languages: Python 3.12 for Spark/Flink jobs and Airflow DAGs; SQL (dbt); Java for Kafka producers (existing)
- Governance: AWS Glue Data Catalog + column-level masking for PII via Snowflake row access policies

Architecture Overview
Lambda architecture: Kafka/Flink handles real-time sub-minute aggregates written to Iceberg; Spark handles nightly full-refresh batch jobs to Snowflake via dbt. SageMaker trains churn and recommendation models weekly on Snowflake feature exports.

2. Deliverables
- MSK Kafka cluster with producer integration guide
- Flink stream processing jobs on EMR Serverless
- Spark ETL jobs with EMR Serverless launch templates
- Apache Iceberg lakehouse schemas and partitioning strategy
- dbt project (50+ models, tests, documentation)
- Snowflake environment with RBAC and row-access policies
- MWAA Airflow DAGs for full pipeline orchestration
- SageMaker Feature Store and model training pipelines
- Terraform infrastructure-as-code for all AWS resources

3. Estimated Schedule and Charges
Engagement type: Greenfield data platform
Timeline: 32 weeks
Estimated hours: 2,400–2,800 hours
Blended hourly rate: $195/hr
Estimated total investment: $468,000–$546,000`,
  },
];

async function main() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(readFileSync(KEY_PATH, 'utf-8')),
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  const authClient = await auth.getClient();
  const docs = google.docs({ version: 'v1', auth: authClient as never });
  const drive = google.drive({ version: 'v3', auth: authClient as never });

  console.log(`Creating ${TEST_SOWS.length} test SOW documents...\n`);

  for (const sow of TEST_SOWS) {
    process.stdout.write(`  ${sow.title} ... `);

    // 1. Copy template into Test Scopes folder
    const copied = await drive.files.copy({
      fileId: TEMPLATE_ID,
      supportsAllDrives: true,
      requestBody: {
        name: sow.title,
        parents: [FOLDER_ID],
      },
      fields: 'id',
    });
    const docId = copied.data.id!;

    // 2. Replace cover page placeholders
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          { replaceAllText: { containsText: { text: 'Project Name', matchCase: true }, replaceText: sow.projectName } },
          { replaceAllText: { containsText: { text: 'CompanyName', matchCase: true }, replaceText: sow.clientName } },
          { replaceAllText: { containsText: { text: 'Client Contact', matchCase: true }, replaceText: sow.contact } },
          { replaceAllText: { containsText: { text: 'Sales Name', matchCase: true }, replaceText: 'Keyhole Software' } },
          { replaceAllText: { containsText: { text: 'October 15, 2020', matchCase: true }, replaceText: sow.date } },
          { replaceAllText: { containsText: { text: '913-626-8342', matchCase: false }, replaceText: '913-555-0100' } },
        ],
      },
    });

    // 3. Find "1. Scope of Services" index and replace everything from there to end
    const doc = await docs.documents.get({ documentId: docId });
    const body = doc.data.body!.content!;
    const endIndex = body[body.length - 1].endIndex! - 1; // exclusive endIndex minus trailing newline

    let scopeStart = -1;
    for (const el of body) {
      if (!el.paragraph) continue;
      for (const pe of el.paragraph.elements ?? []) {
        const text = pe.textRun?.content ?? '';
        if (text.includes('1. Scope of Services') || text.includes('Scope of Services')) {
          scopeStart = el.startIndex!;
          break;
        }
      }
      if (scopeStart !== -1) break;
    }

    if (scopeStart === -1 || scopeStart >= endIndex) {
      // Fallback: append at end
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [{ insertText: { endOfSegmentLocation: { segmentId: '' }, text: '\n\n' + sow.body } }],
        },
      });
    } else {
      // Delete from "1. Scope of Services" to end, then insert our body
      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            { deleteContentRange: { range: { startIndex: scopeStart, endIndex } } },
            { insertText: { location: { index: scopeStart }, text: sow.body } },
          ],
        },
      });
    }

    console.log(`done (${docId})`);
  }

  console.log(`\nAll ${TEST_SOWS.length} documents created.`);
}

main().catch((err) => {
  console.error('Error:', err.message ?? err);
  process.exit(1);
});
