import { expect } from 'chai';

import { toDCI } from '../src/Adaptor.js';

describe('toDCI — interface-specific schemas', () => {
  it('maps local data into a CRVSPerson [crvs]', async () => {
    const state = {
      configuration: {
        schema: 'CRVSPerson',
        mapping: {
          identifier: { identifier_type: '=UIN', identifier_value: 'nationalId' },
          name: { surname: 'lastName', given_name: 'firstName' },
          sex: 'gender',
          birth_date: 'dob',
          address: {
            address_line1: 'addr1',
            address_line2: 'addr2',
            locality: 'city',
            country_code: 'country',
          },
          marital_status: 'maritalCode',
          parent1_identifier: {
            identifier_type: '=UIN',
            identifier_value: 'parent1Id',
          },
        },
      },
      data: {
        nationalId: '197382465',
        lastName: 'Martinez',
        firstName: 'Elena',
        gender: 'female',
        dob: '1980-03-23T10:20:15',
        addr1: 'Line1',
        addr2: 'Line2',
        city: 'Madrid',
        country: 'ES',
        maritalCode: 'S',
        parent1Id: '537564821',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      identifier: { identifier_type: 'UIN', identifier_value: '197382465' },
      name: { surname: 'Martinez', given_name: 'Elena' },
      sex: 'female',
      birth_date: '1980-03-23T10:20:15',
      address: {
        address_line1: 'Line1',
        address_line2: 'Line2',
        locality: 'Madrid',
        country_code: 'ES',
      },
      marital_status: 'S',
      parent1_identifier: { identifier_type: 'UIN', identifier_value: '537564821' },
    });
  });

  it('maps local data into a DisabledPerson [dr]', async () => {
    const state = {
      configuration: {
        schema: 'DisabledPerson',
        mapping: {
          disability_details: {
            impairment_type: 'impType',
            impairment_level: 'impLevel',
          },
        },
      },
      data: { impType: 'Physical', impLevel: 'Severe' },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      disability_details: { impairment_type: 'Physical', impairment_level: 'Severe' },
    });
  });

  it('maps local data into a DisabilityInfo [dr]', async () => {
    const state = {
      configuration: {
        schema: 'DisabilityInfo',
        mapping: {
          personal_details: {
            identifier: 'localId',
            name: { first_name: 'fname', last_name: 'lname' },
            gender: 'sexCode',
          },
          disability_status: 'status',
          disability_level: 'level',
        },
      },
      data: {
        localId: '123456',
        fname: 'John',
        lname: 'Doe',
        sexCode: 'Male',
        status: 'Approved',
        level: 'Severe',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      personal_details: {
        identifier: '123456',
        name: { first_name: 'John', last_name: 'Doe' },
        gender: 'Male',
      },
      disability_status: 'Approved',
      disability_level: 'Severe',
    });
  });

  it('maps local data into a DisabilitySupport [dr]', async () => {
    const state = {
      configuration: {
        schema: 'DisabilitySupport',
        mapping: {
          human_assistance: {
            type: 'assistType',
            frequency: 'freq',
            support_status: 'suppStatus',
          },
        },
      },
      data: { assistType: 'mobility', freq: 'Daily', suppStatus: 'Needed' },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      human_assistance: { type: 'mobility', frequency: 'Daily', support_status: 'Needed' },
    });
  });

  it('maps local data into an IBRPerson [ibr]', async () => {
    const state = {
      configuration: {
        schema: 'IBRPerson',
        mapping: {
          identifier: { identifier_type: '=UIN', identifier_value: 'nid' },
          name: { given_name: 'fname', surname: 'lname' },
          sex: 'gender',
          poverty_score: 'povScore',
          enrolment_status: 'enrolStatus',
          benefit_type: 'benType',
        },
      },
      data: {
        nid: '847951632',
        fname: 'Sudarat',
        lname: 'Phumchai',
        gender: 'female',
        povScore: '0.3',
        enrolStatus: '3',
        benType: '2',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      identifier: { identifier_type: 'UIN', identifier_value: '847951632' },
      name: { given_name: 'Sudarat', surname: 'Phumchai' },
      sex: 'female',
      poverty_score: '0.3',
      enrolment_status: '3',
      benefit_type: '2',
    });
  });

  it('maps local data into a Beneficiary [ibr]', async () => {
    const state = {
      configuration: {
        schema: 'Beneficiary',
        mapping: {
          assistance_unit: 'unit',
          member: {
            member_identifier: 'memberId',
            demographic_info: {
              person: {
                identifier_type: '=NID',
                identifier_value: 'personId',
                name: { given_name: 'fname', surname: 'lname' },
                sex: 'sexCode',
              },
            },
            marital_status: 'maritalCode',
            employment_status: 'empStatus',
          },
        },
      },
      data: {
        unit: '1',
        memberId: 'HS0205202401',
        personId: '0205202401',
        fname: 'Test',
        lname: 'Test3',
        sexCode: 'F',
        maritalCode: 'Single',
        empStatus: 'employed',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      assistance_unit: '1',
      member: {
        member_identifier: 'HS0205202401',
        demographic_info: {
          person: {
            identifier_type: 'NID',
            identifier_value: '0205202401',
            name: { given_name: 'Test', surname: 'Test3' },
            sex: 'F',
          },
        },
        marital_status: 'Single',
        employment_status: 'employed',
      },
    });
  });

  it('maps local data into an FRPerson [fr] (with nested famer_personal_details/family_details)', async () => {
    const state = {
      configuration: {
        schema: 'FRPerson',
        mapping: {
          famer_personal_details: {
            member_identifier: {
              identifier_type: '=NationalID',
              identifier_value: 'memberId',
            },
            demographic_info: {
              identifier: { identifier_type: '=NationalID', identifier_value: 'personId' },
              name: { first_name: 'fname', last_name: 'lname' },
              gender: 'sexCode',
            },
          },
          family_details: {
            group_type: 'famType',
            poverty_score: 'povScore',
          },
        },
      },
      data: {
        memberId: 'M123456',
        personId: 'M123456',
        fname: 'John',
        lname: 'Doe',
        sexCode: 'Male',
        famType: 'family',
        povScore: '45.2',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      famer_personal_details: {
        member_identifier: { identifier_type: 'NationalID', identifier_value: 'M123456' },
        demographic_info: {
          identifier: { identifier_type: 'NationalID', identifier_value: 'M123456' },
          name: { first_name: 'John', last_name: 'Doe' },
          gender: 'Male',
        },
      },
      family_details: { group_type: 'family', poverty_score: '45.2' },
    });
  });

  it('maps local data into an AlertFeature [ews] (with nested properties.capAlert.info)', async () => {
    const state = {
      configuration: {
        schema: 'AlertFeature',
        mapping: {
          id: 'alertId',
          properties: {
            capAlert: {
              identifier: 'capId',
              sender: 'senderOrg',
              status: 'statusCode',
              msgType: 'msgTypeCode',
              scope: 'scopeCode',
              info: {
                event: 'eventType',
                urgency: 'urgencyCode',
                severity: 'severityCode',
                headline: 'headlineText',
              },
            },
          },
        },
      },
      data: {
        alertId: 'ALERT-2026-00001',
        capId: 'ALERT-2026-00001',
        senderOrg: 'ews.gov.lb',
        statusCode: 'Actual',
        msgTypeCode: 'Alert',
        scopeCode: 'Public',
        eventType: 'Flash Flood',
        urgencyCode: 'Immediate',
        severityCode: 'Severe',
        headlineText: 'Flash Flood Warning',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      id: 'ALERT-2026-00001',
      properties: {
        capAlert: {
          identifier: 'ALERT-2026-00001',
          sender: 'ews.gov.lb',
          status: 'Actual',
          msgType: 'Alert',
          scope: 'Public',
          info: {
            event: 'Flash Flood',
            urgency: 'Immediate',
            severity: 'Severe',
            headline: 'Flash Flood Warning',
          },
        },
      },
    });
  });
});
