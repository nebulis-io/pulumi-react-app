import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';
import { getDomainAndSubdomain } from './certificate';



function createAliasRecord(targetDomain: string, distribution: aws.cloudfront.Distribution, parent?: pulumi.ComponentResource): aws.route53.Record {
    const domainParts = getDomainAndSubdomain(targetDomain);
    const hostedZoneId = aws.route53.getZone({ name: domainParts.parentDomain }, { async: true }).then(zone => zone.zoneId);
    return new aws.route53.Record(
        targetDomain,
        {
            name: domainParts.subdomain,
            zoneId: hostedZoneId,
            type: "A",
            aliases: [
                {
                    name: distribution.domainName,
                    zoneId: distribution.hostedZoneId,
                    evaluateTargetHealth: true,
                },
            ],
        },
        { parent });
}

export { createAliasRecord };
