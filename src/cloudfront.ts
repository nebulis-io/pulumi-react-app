import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';



function createDistribution(domainName: string, siteBucket: aws.s3.Bucket, logsBucket: aws.s3.Bucket, certificateArn: pulumi.Output<string>, parent?: pulumi.ComponentResource): aws.cloudfront.Distribution {

    const distributionArgs: aws.cloudfront.DistributionArgs = certificateArn.apply(cert => {
        return {
            enabled: true,
            // Alternate aliases the CloudFront distribution can be reached at, in addition to https://xxxx.cloudfront.net.
            // Required if you want to access the distribution via config.targetDomain as well.
            aliases: [domainName],

            // We only specify one origin for this distribution, the S3 content bucket.
            origins: [
                {
                    originId: siteBucket.arn,
                    domainName: siteBucket.websiteEndpoint,
                    customOriginConfig: {
                        // Amazon S3 doesn't support HTTPS connections when using an S3 bucket configured as a website endpoint.
                        // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-web-values-specify.html#DownloadDistValuesOriginProtocolPolicy
                        originProtocolPolicy: "http-only",
                        httpPort: 80,
                        httpsPort: 443,
                        originSslProtocols: ["TLSv1.2"],
                    },
                },
            ],

            defaultRootObject: "index.html",

            // A CloudFront distribution can configure different cache behaviors based on the request path.
            // Here we just specify a single, default cache behavior which is just read-only requests to S3.
            defaultCacheBehavior: {
                targetOriginId: siteBucket.arn,

                viewerProtocolPolicy: "redirect-to-https",
                allowedMethods: ["GET", "HEAD", "OPTIONS"],
                cachedMethods: ["GET", "HEAD", "OPTIONS"],

                forwardedValues: {
                    cookies: { forward: "none" },
                    queryString: false,
                },

                minTtl: 0,
                defaultTtl: 600,
                maxTtl: 600,
            },

            // "All" is the most broad distribution, and also the most expensive.
            // "100" is the least broad, and also the least expensive.
            priceClass: "PriceClass_100",

            // You can customize error responses. When CloudFront recieves an error from the origin (e.g. S3 or some other
            // web service) it can return a different error code, and return the response for a different resource.
            customErrorResponses: [
                { errorCode: 404, responseCode: 404, responsePagePath: "/404.html" },
            ],

            restrictions: {
                geoRestriction: {
                    restrictionType: "none",
                },
            },

            viewerCertificate: {
                acmCertificateArn: cert,  // Per AWS, ACM certificate must be in the us-east-1 region.
                sslSupportMethod: "sni-only",
            },

            loggingConfig: {
                bucket: logsBucket.bucketDomainName,
                includeCookies: false,
                prefix: `${domainName}/`,
            },
        };
    })

    return new aws.cloudfront.Distribution("cdn", distributionArgs, { parent });

}

export { createDistribution };
