import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { createBucketFromFolder } from './bucket';
import { createCertificate } from './certificate';
import { createDistribution } from './cloudfront';
import { createAliasRecord } from './route53';
import { execSync } from 'child_process';

interface ReactAppArgs {
    path: string;
    domainName: string;
    certificateArn?: string;
}

class ReactApp extends pulumi.ComponentResource {

    siteBucket: aws.s3.Bucket;
    logsBucket: aws.s3.Bucket;
    siteObjects: aws.s3.BucketObject[];
    distribution: aws.cloudfront.Distribution;
    aliasRecord: aws.route53.Record;

    constructor(appName: string, args: ReactAppArgs, opts?: pulumi.ComponentResourceOptions) {
        super("nebulis:ReactApp", appName, {}, opts);

        execSync(`npm --prefix ${args.path} install`);
        execSync(`npm --prefix ${args.path} run build`);

        const { bucket: siteBucket, objects: siteObjects } = createBucketFromFolder(`${args.path}/build`, args.domainName, this);

        const certificateArn = args.certificateArn ? pulumi.output(args.certificateArn) : createCertificate(args.domainName, this).arn;

        const logsBucket = new aws.s3.Bucket("requestLogs", {
            bucket: `${args.domainName}-logs`,
            acl: "private",
        }, {
            parent: this
        });

        const distribution = createDistribution(args.domainName, siteBucket, logsBucket, certificateArn, this);

        const aliasRecord = createAliasRecord(args.domainName, distribution, this);

        this.siteBucket = siteBucket;
        this.logsBucket = logsBucket;
        this.siteObjects = siteObjects
        this.distribution = distribution;
        this.aliasRecord = aliasRecord;

        certificateArn.apply(
            arn => this.registerOutputs({
                bucket: this.siteBucket,
                objects: this.siteObjects,
                distribution: this.distribution,
                aliasRecord: this.aliasRecord,
                certificateArn: arn
            })
        );
    }
}

export { ReactApp };
