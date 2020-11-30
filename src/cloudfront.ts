import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { ReactAppCertificate } from './route53';


export interface ReactAppDistributionArgs {
    /**
     * Bucket storing the static website
     */
    contentBucket: aws.s3.Bucket | pulumi.Output<aws.s3.Bucket>;


    /**
     * TTL allowed for CloudFront cache
     */
    ttl: number | pulumi.Output<number>;

    /**
     * Is Logging enabled for this distribution
     */
    loggingEnabled: boolean | pulumi.Output<boolean>;

    /**
     * Domain used for this distribution
     */
    domain: string | pulumi.Output<string>

    /**
     * Certificate ARN if one is already in use
     */
    certificateArn?: string | pulumi.Output<string>
}


export class ReactAppDistribution extends pulumi.ComponentResource {

    cdn: pulumi.Output<aws.cloudfront.Distribution>
    loggingBucket?: pulumi.Output<aws.s3.Bucket>
    certificate?: pulumi.Output<ReactAppCertificate>

    constructor(appName: string, args: ReactAppDistributionArgs, opts?: pulumi.ComponentResourceOptions) {
        super("nebulis:ReactAppDistribution", appName, {}, opts);

        let loggingConfig: aws.types.input.cloudfront.DistributionLoggingConfig | undefined = undefined;

        if (args.loggingEnabled) {
            this.loggingBucket = pulumi.output(new aws.s3.Bucket(`${appName}-${args.domain}-logs`,
                {
                    bucket: `${appName}-${args.domain}-logs`,
                    acl: "private",
                    forceDestroy: true
                }, {
                parent: this
            }));
            loggingConfig = {
                bucket: this.loggingBucket.bucketDomainName,
                includeCookies: false,
                prefix: `${args.domain}/`,
            }
        }

        let certificateArn: string | pulumi.Output<string>

        if (args.certificateArn == undefined) {
            this.certificate = pulumi.output(
                new ReactAppCertificate(appName, {
                    ttl: args.ttl,
                    domain: args.domain
                }, {
                    parent: this
                })
            )
            certificateArn = this.certificate.certificateValidation.apply(certificate => certificate?.certificateArn)
        } else {
            certificateArn = args.certificateArn;
        }

        this.cdn = pulumi.output(new aws.cloudfront.Distribution(appName, {
            enabled: true,
            aliases: [args.domain],
            origins: [
                {
                    originId: args.contentBucket.arn,
                    domainName: args.contentBucket.websiteEndpoint,
                    customOriginConfig: {
                        originProtocolPolicy: "http-only",
                        httpPort: 80,
                        httpsPort: 443,
                        originSslProtocols: ["TLSv1.2"],
                    },
                },
            ],

            defaultRootObject: "index.html",
            defaultCacheBehavior: {
                targetOriginId: args.contentBucket.arn,

                viewerProtocolPolicy: "redirect-to-https",
                allowedMethods: ["GET", "HEAD", "OPTIONS"],
                cachedMethods: ["GET", "HEAD", "OPTIONS"],

                forwardedValues: {
                    cookies: { forward: "none" },
                    queryString: false,
                },

                minTtl: 0,
                defaultTtl: args.ttl,
                maxTtl: args.ttl,
            },
            priceClass: "PriceClass_100",
            customErrorResponses: [
                { errorCode: 404, responseCode: 404, responsePagePath: "/404.html" },
            ],
            restrictions: {
                geoRestriction: {
                    restrictionType: "none",
                },
            },
            viewerCertificate: {
                acmCertificateArn: certificateArn,
                sslSupportMethod: "sni-only",
            },
            loggingConfig
        }, {
            parent: this
        }));

        this.registerOutputs({
            cdn: this.cdn,
            loggingBucket: this.loggingBucket
        })

    }

}
