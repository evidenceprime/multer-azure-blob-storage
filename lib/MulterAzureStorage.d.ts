import { Request } from "express";
import { StorageEngine } from "multer";
import { PublicAccessType } from "@azure/storage-blob";
export type MetadataObj = {
    [k: string]: string;
};
export type MASNameResolver = (req: Request, file: Express.Multer.File) => Promise<string>;
export type MASObjectResolver = (req: Request, file: Express.Multer.File) => Promise<MetadataObj>;
export type ContainerAccessLevel = PublicAccessType | "off";
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
export declare class MASError implements Error {
    name: string;
    message: string;
    errorList: Error[];
    constructor(message?: string);
}
export declare class MulterAzureStorage implements StorageEngine {
    private readonly DEFAULT_UPLOAD_CONTAINER;
    private readonly DEFAULT_CONTAINER_ACCESS_LEVEL;
    private readonly _error;
    private readonly _blobService;
    private readonly _blobName;
    private readonly _metadata;
    private readonly _containerName;
    private readonly _containerAccessLevel;
    private readonly _bufferSize;
    private readonly _maxBufferCount;
    constructor(options: IMASOptions);
    _handleFile(req: Request, file: Express.Multer.File, cb: (error?: any, info?: Partial<MulterOutFile>) => void): Promise<void>;
    _removeFile(req: Request, file: MulterOutFile, cb: (error: Error) => void): Promise<void>;
    /** Helpers */
    private _doesContainerExists;
    private _createContainerIfNotExists;
    private _getUrl;
    private _getBlobProperties;
    private _deleteBlobIfExists;
    private _generateBlobName;
    private _promisifyStaticValue;
    private _promisifyStaticObj;
}
export default MulterAzureStorage;
