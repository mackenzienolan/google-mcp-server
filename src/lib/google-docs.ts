import { google } from 'googleapis';
import { getGoogleTokens } from './auth';

export class GoogleDocsClient {
  private oauth2Client: InstanceType<typeof google.auth.OAuth2>;
  private docs: any;
  private drive: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    this.docs = google.docs({ version: 'v1', auth: this.oauth2Client });
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  private async setUserCredentials(userId: string) {
    const tokens = await getGoogleTokens(userId);
    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  }

  async readDocument(userId: string, documentId: string) {
    await this.setUserCredentials(userId);
    
    const doc = await this.docs.documents.get({ documentId });
    const content = this.extractTextFromDocument(doc.data);

    return {
      documentId,
      title: doc.data.title,
      content,
    };
  }

  async createDocument(userId: string, title: string) {
    await this.setUserCredentials(userId);
    
    const doc = await this.docs.documents.create({
      requestBody: { title },
    });

    return {
      documentId: doc.data.documentId,
      title: doc.data.title,
      revisionId: doc.data.revisionId,
    };
  }

  async updateDocument(userId: string, documentId: string, requests: any[]) {
    await this.setUserCredentials(userId);
    
    const result = await this.docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    return {
      documentId,
      replies: result.data.replies,
    };
  }

  async appendText(userId: string, documentId: string, text: string) {
    await this.setUserCredentials(userId);
    
    const doc = await this.docs.documents.get({ documentId });
    const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex || 1;

    const requests = [
      {
        insertText: {
          location: { index: endIndex - 1 },
          text: text,
        },
      },
    ];

    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });

    return `Text appended successfully to document ${documentId}`;
  }

  async listDocuments(userId: string, pageSize: number = 10) {
    await this.setUserCredentials(userId);
    
    const response = await this.drive.files.list({
      q: "mimeType='application/vnd.google-apps.document'",
      pageSize: Math.min(pageSize, 100),
      fields: 'files(id, name, createdTime, modifiedTime)',
    });

    return {
      documents: response.data.files,
    };
  }

  private extractTextFromDocument(doc: any): string {
    let text = '';

    if (doc.body?.content) {
      for (const element of doc.body.content) {
        if (element.paragraph?.elements) {
          for (const elem of element.paragraph.elements) {
            if (elem.textRun?.content) {
              text += elem.textRun.content;
            }
          }
        }
      }
    }

    return text;
  }
}

export const googleDocsClient = new GoogleDocsClient();