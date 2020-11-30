import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import * as utils from './utils';

export interface ReactAppAliasRecordArgs {

    /**
     * Distribution used for the app
     */
    distribution: aws.cloudfront.Distribution | pulumi.Output<aws.cloudfront.Distribution>

    /**
     * Domain used for the app
     */
    domain: string | pulumi.Output<string>

}

export class ReactAppAliasRecord extends pulumi.ComponentResource {

    record: pulumi.Output<aws.route53.Record>

    constructor(appName: string, args: ReactAppAliasRecordArgs, opts: pulumi.ComponentResourceOptions) {
        super("nebulis:ReactAppAliasRecord", appName, {}, opts);
        const domainParts = utils.getDomainAndSubdomain(args.domain);
        const hostedZoneId = domainParts.parentDomain.apply(name => aws.route53.getZone({ name }, { async: true })).apply(zone => zone.zoneId);
        this.record = pulumi.output(
            new aws.route53.Record(
                `${appName}-${args.domain}-aliasRecord`,
                {
                    name: domainParts.subdomain,
                    zoneId: hostedZoneId,
                    type: "A",
                    aliases: [
                        {
                            name: args.distribution.domainName,
                            zoneId: args.distribution.hostedZoneId,
                            evaluateTargetHealth: true,
                        },
                    ],
                }
            )
        );
        this.registerOutputs({
            record: this.record
        })
    }

}

export interface ReactAppCertificateArgs {
    /**
     * Domain used for this distribution
     */
    domain: string | pulumi.Output<string>

    /**
     * TTL for DNS cache
     */
    ttl: number | pulumi.Output<number>
}

export class ReactAppCertificate extends pulumi.ComponentResource {

    certificate: pulumi.Output<aws.acm.Certificate>
    certificateValidationDomain: pulumi.Output<aws.route53.Record>
    certificateValidation: pulumi.Output<aws.acm.CertificateValidation>;


    constructor(appName: string, args: ReactAppCertificateArgs, opts: pulumi.ComponentResourceOptions) {
        super("nebulis:ReactAppCertificate", appName, {}, opts);

        const eastRegion = new aws.Provider(
            "east",
            {
                profile: aws.config.profile,
                region: "us-east-1",
            }
        );

        this.certificate = pulumi.output(
            new aws.acm.Certificate(
                `${appName}-${args.domain}-certificate`,
                {
                    domainName: args.domain,
                    validationMethod: "DNS",
                },
                {
                    provider: eastRegion,
                    parent: this
                }
            )
        );


        const domainParts = utils.getDomainAndSubdomain(args.domain);
        const hostedZoneId = domainParts.parentDomain.apply(name => aws.route53.getZone({ name }, { async: true })).apply(zone => zone.zoneId);

        this.certificateValidationDomain = pulumi.output(
            new aws.route53.Record(
                `${appName}-${args.domain}-validation`,
                {
                    name: this.certificate.domainValidationOptions[0].resourceRecordName,
                    zoneId: hostedZoneId,
                    type: this.certificate.domainValidationOptions[0].resourceRecordType,
                    records: [this.certificate.domainValidationOptions[0].resourceRecordValue],
                    ttl: args.ttl,
                },
                {
                    parent: this
                }
            )
        );

        this.certificateValidation = pulumi.output(
            new aws.acm.CertificateValidation(
                `${appName}-${args.domain}-certificateValidation`,
                {
                    certificateArn: this.certificate.arn,
                    validationRecordFqdns: [this.certificateValidationDomain.fqdn],
                },
                {
                    provider: eastRegion,
                    parent: this,
                }
            )
        );

        this.registerOutputs({
            certificate: this.certificate,
            certificateValidationDomain: this.certificateValidationDomain,
            certificateValidation: this.certificateValidation
        })

    }

}

