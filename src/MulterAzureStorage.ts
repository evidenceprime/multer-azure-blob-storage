// *********************************************************
//
// This file is subject to the terms and conditions defined in
// file 'LICENSE.txt', which is part of this source code package.
//
// *********************************************************

// Node Modules
import { v4 } from "uuid";
import { extname } from "path";
import { Request } from "express";
import { StorageEngine } from "multer";
import {
  BlobGetPropertiesResponse,
  BlobServiceClient,
  PublicAccessType,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

// Custom types
export type MetadataObj = { [k: string]: string };
export type MASNameResolver = (
  req: Request,
  file: Express.Multer.File
) => Promise<string>;
export type MASObjectResolver = (
  req: Request,
  file: Express.Multer.File
) => Promise<MetadataObj>;
export type ContainerAccessLevel = PublicAccessType | "off";

// Custom interfaces
export interface IMASOptions {
  accessKey?: string;
  accountName?: string;
  connectionString?: string;
  blobName?: MASNameResolver;
  containerName: MASNameResolver | string;
  metadata?: MASObjectResolver | MetadataObj;
  contentSettings?: MASObjectResolver | MetadataObj;
  containerAccessLevel?: ContainerAccessLevel;
  bufferSizeInMB?: number;
  maxBufferCount?: number;
}

export interface MulterOutFile extends Express.Multer.File {
  url: string;
  etag: string;
  metadata: MetadataObj;
  blobName: string;
  blobType: string;
  blobSize: number;
  containerName: string;
}

// Custom error class
export class MASError implements Error {
  name: string;
  message: string;
  errorList: Error[];

  constructor(message?: string) {
    this.errorList = [];
    this.name = "Multer Azure Error";
    this.message = message ? message : null;
  }
}

export class MulterAzureStorage implements StorageEngine {
  private readonly DEFAULT_UPLOAD_CONTAINER: string = "default-container";
  private readonly DEFAULT_CONTAINER_ACCESS_LEVEL:
    | PublicAccessType
    | undefined = undefined;

  private readonly _error: MASError;
  private readonly _blobService: BlobServiceClient;
  private readonly _blobName: MASNameResolver;
  private readonly _metadata: MASObjectResolver;
  private readonly _containerName: MASNameResolver;
  private readonly _containerAccessLevel: PublicAccessType | undefined;
  private readonly _bufferSize: number;
  private readonly _maxBufferCount: number;

  constructor(options: IMASOptions) {
    // Init error array
    let errorLength = 0;
    this._error = new MASError();
    // Connection is preferred.
    options.connectionString =
      options.connectionString ||
      process.env.AZURE_STORAGE_CONNECTION_STRING ||
      null;
    if (!options.connectionString) {
      options.accessKey =
        options.accessKey || process.env.AZURE_STORAGE_ACCESS_KEY || null;
      options.accountName =
        options.accountName || process.env.AZURE_STORAGE_ACCOUNT || null;
      // Access key is required if no connection string is provided
      if (!options.accessKey) {
        errorLength++;
        this._error.errorList.push(
          new Error(
            "Missing required parameter: Azure blob storage access key."
          )
        );
      }
      // Account name is required if no connection string is provided
      if (!options.accountName) {
        errorLength++;
        this._error.errorList.push(
          new Error(
            "Missing required parameter: Azure blob storage account name."
          )
        );
      }
    }
    // Container name is required
    if (!options.containerName) {
      errorLength++;
      this._error.errorList.push(
        new Error("Missing required parameter: Azure container name.")
      );
    }
    // Validate errors before proceeding
    if (errorLength > 0) {
      const inflection: string[] = errorLength > 1 ? ["are", "s"] : ["is", ""];
      this._error.message = `There ${inflection[0]} ${errorLength} missing required parameter${inflection[1]}.`;
      throw this._error;
    }
    // Set proper container name
    switch (typeof options.containerName) {
      case "string":
        this._containerName = this._promisifyStaticValue(options.containerName);
        break;

      case "function":
        this._containerName = <MASNameResolver>options.containerName;
        break;

      default:
        // Catch for if container name is provided but not a desired type
        this._containerName = this._promisifyStaticValue(
          this.DEFAULT_UPLOAD_CONTAINER
        );
        break;
    }
    // Set container access level
    if (
      !options.containerAccessLevel ||
      options.containerAccessLevel === "off"
    ) {
      this._containerAccessLevel = this.DEFAULT_CONTAINER_ACCESS_LEVEL;
    } else {
      this._containerAccessLevel = options.containerAccessLevel;
    }
    // Check for metadata
    if (!options.metadata) {
      this._metadata = null;
    } else {
      switch (typeof options.metadata) {
        case "object":
          this._metadata = this._promisifyStaticObj(
            <MetadataObj>options.metadata
          );
          break;

        case "function":
          this._metadata = <MASObjectResolver>options.metadata;
          break;

        default:
          // Nullify all other types
          this._metadata = null;
          break;
      }
    }
    // Set proper blob name
    this._blobName = options.blobName
      ? options.blobName
      : this._generateBlobName;
    // Set buffer settings
    this._bufferSize = 1024 * 1024 * (options.bufferSizeInMB ?? 4);
    this._maxBufferCount = options.maxBufferCount ?? 20;
    // Init blob service
    this._blobService = options.connectionString
      ? BlobServiceClient.fromConnectionString(options.connectionString)
      : new BlobServiceClient(
          `https://${options.accountName}.blob.core.windows.net`,
          new StorageSharedKeyCredential(options.accountName, options.accessKey)
        );
  }

  async _handleFile(
    req: Request,
    file: Express.Multer.File,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cb: (error?: any, info?: Partial<MulterOutFile>) => void
  ) {
    // Ensure we have no errors during setup
    if (this._error.errorList.length > 0) {
      cb(this._error);
    } else {
      // All good. Continue...
    }
    // Begin handling file
    try {
      // Resolve blob name and container name
      const blobName: string = await this._blobName(req, file);
      const containerName: string = await this._containerName(req, file);
      // Create container if it doesn't exist
      await this._createContainerIfNotExists(
        containerName,
        this._containerAccessLevel
      );
      // Upload away
      await this._blobService
        .getContainerClient(containerName)
        .getBlockBlobClient(blobName)
        .uploadStream(file.stream, this._bufferSize, this._maxBufferCount, {
          metadata: <MetadataObj>await this._metadata(req, file),
          blobHTTPHeaders: { blobContentType: file.mimetype },
        });
      const properties = await this._getBlobProperties(containerName, blobName);
      const fileToReturn: Partial<MulterOutFile> = Object.assign({}, file, {
        url: this._getUrl(containerName, blobName),
        blobName,
        containerName,
        etag: properties.etag,
        blobType: properties.blobType,
        metadata: properties.metadata,
        blobSize: properties.contentLength,
      });
      cb(null, fileToReturn);
    } catch (hFError) {
      cb(hFError);
    }
  }

  async _removeFile(
    req: Request,
    file: MulterOutFile,
    cb: (error: Error) => void
  ) {
    // Ensure we have no errors during setup
    if (this._error.errorList.length > 0) {
      cb(this._error);
    } else {
      // All good. Continue...
    }
    // Begin File removal
    try {
      const containerName: string = await this._containerName(req, file);
      const exists = await this._doesContainerExists(containerName);
      if (!exists) {
        this._error.message =
          "Cannot use container. Check if provided options are correct.";
        cb(this._error);
      } else {
        await this._deleteBlobIfExists(containerName, file.blobName);
        cb(null);
      }
    } catch (rFError) {
      cb(rFError);
    }
  }

  /** Helpers */

  private async _doesContainerExists(containerName: string): Promise<boolean> {
    return await this._blobService.getContainerClient(containerName).exists();
  }

  private async _createContainerIfNotExists(
    name: string,
    accessLevel?: PublicAccessType
  ): Promise<void> {
    await this._blobService
      .getContainerClient(name)
      .createIfNotExists({ access: accessLevel });
  }

  private _getUrl(containerName: string, blobName: string): string {
    return this._blobService
      .getContainerClient(containerName)
      .getBlobClient(blobName).url;
  }

  private async _getBlobProperties(
    containerName: string,
    blobName: string
  ): Promise<BlobGetPropertiesResponse> {
    return await this._blobService
      .getContainerClient(containerName)
      .getBlobClient(blobName)
      .getProperties();
  }

  private async _deleteBlobIfExists(
    containerName: string,
    blobName: string
  ): Promise<void> {
    await this._blobService
      .getContainerClient(containerName)
      .getBlobClient(blobName)
      .deleteIfExists();
  }

  private _generateBlobName(
    _req: Request,
    file: Express.Multer.File
  ): Promise<string> {
    return Promise.resolve(
      `${Date.now()}-${v4()}${extname(file.originalname)}`
    );
  }

  private _promisifyStaticValue(value: string): MASNameResolver {
    return (): Promise<string> => {
      return Promise.resolve(value);
    };
  }

  private _promisifyStaticObj(value: MetadataObj): MASObjectResolver {
    return (): Promise<MetadataObj> => {
      return Promise.resolve(value);
    };
  }
}

export default MulterAzureStorage;
