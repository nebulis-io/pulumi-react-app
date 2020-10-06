import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { S3Folder } from './s3folder';
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

    bucket?: pulumi.Output<S3Folder>;
    assetArchive: pulumi.Output<pulumi.asset.AssetArchive>;

    constructor(appName: string, args: S3ReactAppArgs, opts?: pulumi.ComponentResourceOptions) {
        super("nebulis:ReactApp", appName, {}, opts);
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

export { S3ReactApp, S3Folder, utils };

