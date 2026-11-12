import { supabase } from '../cloud/supabaseClient.ts'
import type { LocalProfile } from '../hydrate/hydrateMergeTypes.ts'
import type { FinanceSettings } from '../../domain/financeTypes.ts'

export async function upsertProfileOnSupabase(userId: string, profile: LocalProfile, settings: FinanceSettings, { ownFieldsOnly = false }: { ownFieldsOnly?: boolean } = {}) {
  const businessAndAccount = ownFieldsOnly ? {} : {
    business_name: profile.bizName || null,
    business_number: profile.bizNumber || null,
    business_address: profile.bizAddress || null,
    business_type: profile.bizType || null,
    business_item: profile.bizItem || null,
    business_email: profile.bizEmail || null,
    business_representative: profile.bizRepresentative || null,
    bank_name: profile.bankName || null,
    account_number: profile.accountNumber || null,
    account_holder: profile.accountHolder || null,
  }
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    name: profile.name || null,
    phone: profile.phone || null,
    ...businessAndAccount,
    settings,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
