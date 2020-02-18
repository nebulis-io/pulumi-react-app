import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from 'fs';
import * as utils from 'util';
import * as path from 'path';
import * as mime from 'mime';

async function* parseFolder(dir: string): AsyncGenerator<string> {
    const dirents = await utils.promisify(fs.readdir)(dir, { withFileTypes: true });
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* parseFolder(res);
        } else {
            yield res;
        }
    }
}

async function* createS3Objects(folder: string, bucket: aws.s3.Bucket): AsyncGenerator<aws.s3.BucketObject> {
    for await (const filePath of parseFolder(folder)) {
        console.log(fs.statSync(filePath).size)
        yield new aws.s3.BucketObject(
            filePath.split(path.sep).pop() || filePath, {
            bucket,
            acl: 'public-read',
            source: new pulumi.asset.FileAsset(filePath),
            contentType: mime.getType(filePath) || undefined,
        }, {
            parent: bucket
        }
        )
    }
}

async function createBucketFromFolder(folder: string, parent?: pulumi.ComponentResource): Promise<{ bucket: aws.s3.Bucket, objects: aws.s3.BucketObject[] }> {
    let objects = [];
    let siteBucket = new aws.s3.Bucket("crm-webkit-bucket", {
        website: {
            indexDocument: 'index.html'
        },
    }, {
        parent
    });
    for await (const object of createS3Objects(folder, siteBucket)) {
        objects.push(object)
    }
    return { bucket: siteBucket, objects };
}

export { createBucketFromFolder };