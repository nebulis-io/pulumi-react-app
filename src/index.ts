import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { createBucketFromFolder } from './bucket';
import { createCertificate } from './certificate';

interface ReactAppArgs {
    path: string;
    domainName: string;
    certificateArn?: string;
}

class ReactApp extends pulumi.ComponentResource {

    bucket: aws.s3.Bucket;
    objects: aws.s3.BucketObject[];
    certificateArn: string;

    constructor(appName: string, args: ReactAppArgs, opts?: pulumi.ComponentResourceOptions) {
        super("nebulis:ReactApp", appName, {}, opts);

        createBucketFromFolder(args.path, this)
            .then(({ bucket, objects }) => {
                this.bucket = bucket;
                this.objects = objects;
                return pulumi.output(args.certificateArn) || createCertificate(args.domainName).arn
            }).then(certificateArn => {
                return { certificateArn }
            }).then(({ certificateArn }) => {
                certificateArn.apply(
                    arn => this.registerOutputs({
                        bucket: this.bucket,
                        objects: this.objects,
                        certificateArn: arn
                    })
                );
            })
    }
}

export { ReactApp };
