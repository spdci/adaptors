import { expect } from 'chai';

import { toDCI, fromDCI } from '../src/Adaptor.js';

describe('toDCI', () => {
  it('maps local data into a DCI Person', async () => {
    const state = {
      configuration: {
        schema: 'Person',
        mapping: {
          identifier: {
            identifier_type: '=NationalID',
            identifier_value: 'nationalId',
          },
          name: {
            surname: 'lastName',
            given_name: 'firstName',
          },
          sex: 'gender',
          birth_date: {
            source: 'dob',
            sourceFormat: 'DD/MM/YYYY',
            targetFormat: 'YYYY-MM-DDTHH:mm:ss',
          },
          phone_number: 'phone',
        },
        codeLists: {
          sex: { M: 'male', F: 'female' },
        },
      },
      data: {
        firstName: 'Jane',
        lastName: 'Doe',
        gender: 'F',
        dob: '21/09/1995',
        phone: '+123',
        nationalId: 'N123',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      identifier: { identifier_type: 'NationalID', identifier_value: 'N123' },
      name: { surname: 'Doe', given_name: 'Jane' },
      sex: 'female',
      birth_date: '1995-09-21T00:00:00',
      phone_number: '+123',
    });
  });

  it('maps local data into a DCI Member (with nested demographic_info)', async () => {
    const state = {
      configuration: {
        schema: 'Member',
        mapping: {
          member_identifier: {
            identifier_type: 'idType',
            identifier_value: 'idNum',
          },
          demographic_info: {
            name: { given_name: 'firstName' },
            sex: 'gender',
          },
          marital_status: 'maritalStatus',
        },
      },
      data: {
        idType: 'UIN',
        idNum: 'M001',
        firstName: 'Amara',
        gender: 'F',
        maritalStatus: 'S',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      member_identifier: { identifier_type: 'UIN', identifier_value: 'M001' },
      demographic_info: { name: { given_name: 'Amara' }, sex: 'F' },
      marital_status: 'S',
    });
  });

  it('maps local data into a DCI Group (with nested group_head_info)', async () => {
    const state = {
      configuration: {
        schema: 'Group',
        mapping: {
          group_identifier: {
            identifier_type: '=HH',
            identifier_value: 'hhId',
          },
          group_type: 'unitType',
          group_head_info: {
            member_identifier: { identifier_value: 'headId' },
            demographic_info: {
              name: { given_name: 'headName' },
            },
          },
        },
      },
      data: {
        hhId: 'HH100',
        unitType: 'household',
        headId: 'H01',
        headName: 'Kwame',
      },
    };

    const finalState = await toDCI()(state);

    expect(finalState.data).to.eql({
      group_identifier: { identifier_type: 'HH', identifier_value: 'HH100' },
      group_type: 'household',
      group_head_info: {
        member_identifier: { identifier_value: 'H01' },
        demographic_info: { name: { given_name: 'Kwame' } },
      },
    });
  });

  it('throws if configuration.schema/mapping are missing', async () => {
    const error = await toDCI()({ configuration: {}, data: {} }).catch(
      e => e
    );

    expect(error.message).to.include('configuration.schema');
  });
});

describe('fromDCI', () => {
  it('maps a DCI Person back into local field names', async () => {
    const state = {
      configuration: {
        schema: 'Person',
        mapping: {
          identifier: {
            identifier_type: '=NationalID',
            identifier_value: 'nationalId',
          },
          name: {
            surname: 'lastName',
            given_name: 'firstName',
          },
          sex: 'gender',
        },
      },
      data: {
        identifier: { identifier_type: 'NationalID', identifier_value: 'N123' },
        name: { surname: 'Doe', given_name: 'Jane' },
        sex: 'female',
      },
    };

    const finalState = await fromDCI()(state);

    // the constant identifier_type ('=NationalID') is not reversible, so
    // it's skipped rather than written back under a bogus '=NationalID' key
    expect(finalState.data).to.eql({
      nationalId: 'N123',
      lastName: 'Doe',
      firstName: 'Jane',
      gender: 'female',
    });
  });

  it('maps a DCI Member back into local field names (with nested demographic_info)', async () => {
    const state = {
      configuration: {
        schema: 'Member',
        mapping: {
          member_identifier: {
            identifier_type: 'idType',
            identifier_value: 'idNum',
          },
          demographic_info: {
            name: { given_name: 'firstName' },
          },
        },
      },
      data: {
        member_identifier: { identifier_type: 'UIN', identifier_value: 'M001' },
        demographic_info: { name: { given_name: 'Amara' } },
      },
    };

    const finalState = await fromDCI()(state);

    expect(finalState.data).to.eql({
      idType: 'UIN',
      idNum: 'M001',
      firstName: 'Amara',
    });
  });

  it('throws if configuration.schema/mapping are missing', async () => {
    const error = await fromDCI()({ configuration: {}, data: {} }).catch(
      e => e
    );

    expect(error.message).to.include('configuration.schema');
  });
});
