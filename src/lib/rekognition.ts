// ============================================================
// 🐾 Patitas SOS — AWS Rekognition (SDK v3)
//
// - IndexFacesCommand: registra la cara en la colección → FaceId
// - SearchFacesByImageCommand: busca coincidencias con umbral 85.0%
// - DeleteFacesCommand: limpieza de caras huérfanas
// ============================================================

import {
  DeleteFacesCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
} from '@aws-sdk/client-rekognition';

const COLLECTION_ID = process.env.AWS_REKOGNITION_COLLECTION_ID;

const client = new RekognitionClient({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  },
});

/** Se lanza cuando Rekognition no detecta una cara clara en la imagen. */
export class NoFaceDetectedError extends Error {
  constructor() {
    super('No se detectó una cara clara en la imagen.');
    this.name = 'NoFaceDetectedError';
  }
}

export interface FaceMatch {
  FaceId: string;
  ExternalImageId: string | null;
  Similarity: number;
}

function assertConfigured(): void {
  if (!COLLECTION_ID) {
    throw new Error('Falta la variable AWS_REKOGNITION_COLLECTION_ID.');
  }
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error('Faltan credenciales de AWS (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY).');
  }
}

/**
 * Registra la cara de la imagen en la colección.
 * @returns FaceId generado por AWS (o lanza NoFaceDetectedError).
 */
export async function indexFace(imageBytes: Uint8Array, externalImageId: string): Promise<string> {
  assertConfigured();

  const command = new IndexFacesCommand({
    CollectionId: COLLECTION_ID,
    Image: { Bytes: imageBytes },
    ExternalImageId: externalImageId, // ID del reporte (para filtrar auto-coincidencias)
    MaxFaces: 1,
    DetectionAttributes: ['DEFAULT'],
  });

  const response = await client.send(command);
  const face = response.FaceRecords?.[0]?.Face;

  if (!face?.FaceId) {
    throw new NoFaceDetectedError();
  }

  return face.FaceId;
}

/**
 * Busca en la colección caras similares a la imagen dada.
 * @param threshold Umbral de similitud en porcentaje (85.0 en esta app).
 */
export async function searchFacesByImage(
  imageBytes: Uint8Array,
  threshold = 85.0,
): Promise<FaceMatch[]> {
  assertConfigured();

  const command = new SearchFacesByImageCommand({
    CollectionId: COLLECTION_ID,
    Image: { Bytes: imageBytes },
    FaceMatchThreshold: threshold,
    MaxFaces: 10,
  });

  const response = await client.send(command);

  return (response.FaceMatches ?? [])
    .map((match) => ({
      FaceId: match.Face?.FaceId ?? '',
      ExternalImageId: match.Face?.ExternalImageId ?? null,
      Similarity: match.Similarity ?? 0,
    }))
    .filter((match) => match.FaceId !== '');
}

/** Elimina una cara de la colección (limpieza si el reporte no se guarda). */
export async function deleteFace(faceId: string): Promise<void> {
  assertConfigured();

  const command = new DeleteFacesCommand({
    CollectionId: COLLECTION_ID,
    FaceIds: [faceId],
  });

  await client.send(command);
}
