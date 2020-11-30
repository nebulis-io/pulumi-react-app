import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { S3Folder } from './s3folder';
import { ReactAppDistribution } from './cloudfront';
import { ReactAppAliasRecord } from './route53';
import * as utils from "./utils";


interface S3ReactAppArgs {
    /**
     * Path for react app.
     */
    path: string;

    /**
     * Environnement variables to be passed in react build.
     * 
     * It will automatically prepend REACT_APP_
     */
    env?: { [name: string]: string | pulumi.Output<string> }
}

class S3ReactApp extends pulumi.ComponentResource {

    bucket: pulumi.Output<S3Folder>;
    assetArchive: pulumi.Output<pulumi.asset.AssetArchive>;

    constructor(appName: string, args: S3ReactAppArgs, opts?: pulumi.ComponentResourceOptions) {
        super("nebulis:S3ReactApp", appName, {}, opts);
        this.assetArchive = utils.packageReactWebapp(`${args.path}`, args.env);
        this.bucket = pulumi.output(new S3Folder(appName, {
            path: `${args.path}/build`,
            assets: this.assetArchive.assets
        }, {
            parent: this
        }));
        this.registerOutputs({
            bucket: this.bucket,
            assetArchive: this.assetArchive
        })
    }
}


interface SecuredReactAppArgs {
    /**
     * Path for react app.
     */
    path: string;

    /**
     * Environnement variables to be passed in react build.
     * 
     * It will automatically prepend REACT_APP_
     */
    env?: { [name: string]: string | pulumi.Output<string> }

    /**
     * Enable logging for the app distribution
     */
    loggingEnabled: boolean | pulumi.Output<boolean>

    /**
     * Domain used for the application
     */
    domain: string | pulumi.Output<string>
}


class SecuredReactApp extends pulumi.ComponentResource {

    s3app: pulumi.Output<S3ReactApp>;
    distribution: pulumi.Output<ReactAppDistribution>;
    record: pulumi.Output<ReactAppAliasRecord>;

    constructor(appName: string, args: SecuredReactAppArgs, opts?: pulumi.ComponentResourceOptions) {
        super("nebulis:SecuredReactApp", appName, {}, opts);

        this.s3app = pulumi.output(new S3ReactApp(appName, {
            ...args
        }, {
            parent: this
        }));

        this.distribution = pulumi.output(new ReactAppDistribution(appName, {
            contentBucket: this.s3app.bucket.bucket,
            ttl: 60 * 10,
            ...args
        }, {
            parent: this
        }));

        this.record = pulumi.output(new ReactAppAliasRecord(appName, {
            distribution: this.distribution.cdn,
            domain: args.domain
        }, {
            parent: this
        }))

        this.registerOutputs({
            s3app: this.s3app,
            distribution: this.distribution,
            record: this.record
        })

    }

}

export { SecuredReactApp, S3ReactApp, S3Folder, utils };

