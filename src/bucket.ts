import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as fs from 'fs';
import * as path from 'path';
import * as mime from 'mime';


function* parseFolder(dir: string): Generator<string> {
    const dirents = fs.readdirSync(dir, { withFileTypes: true })
    for (const dirent of dirents) {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            yield* parseFolder(res);
        } else {
            yield res;
        }
    }
}

function* createS3Objects(folder: string, bucket: aws.s3.Bucket): Generator<aws.s3.BucketObject> {
    for (const filePath of parseFolder(folder)) {
        const relativeFileName = filePath.replace(path.resolve(folder) + "/", "");
        yield new aws.s3.BucketObject(relativeFileName, {
            bucket,
            key: relativeFileName,
            acl: 'public-read',
            source: new pulumi.asset.FileAsset(filePath),
            contentType: mime.getType(filePath) || undefined,
        }, {
            parent: bucket
        })
    }
}

function createBucketFromFolder(folder: string, domainName: string, parent?: pulumi.ComponentResource): { bucket: aws.s3.Bucket, objects: aws.s3.BucketObject[] } {
    let objects = [];
    let siteBucket = new aws.s3.Bucket("websiteBucket", {
        bucket: domainName,
        acl: "public-read",
        website: {
            indexDocument: 'index.html'
        },
    }, {
        parent
    });
    for (const object of createS3Objects(folder, siteBucket)) {
        objects.push(object)
    }
    return { bucket: siteBucket, objects };
}

export { createBucketFromFolder };
