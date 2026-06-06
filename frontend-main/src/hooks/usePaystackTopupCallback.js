import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import BASE_URL from '../endpoints/endpoints';

const getAuthHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

/**
 * After Paystack redirect (?topup=callback&reference=...), verify and credit wallet.
 */
export function usePaystackTopupCallback(onSuccess) {
  const location = useLocation();
  const navigate = useNavigate();
  const verifiedRefs = useRef(new Set());

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('topup') !== 'callback') return;

    const reference = params.get('reference') || params.get('trxref');
    if (!reference || verifiedRefs.current.has(reference)) return;
    verifiedRefs.current.add(reference);

    navigate(location.pathname, { replace: true });

    Swal.fire({
      title: 'Verifying Payment...',
      text: 'Please wait while we confirm your top-up.',
      allowOutsideClick: false,
      showConfirmButton: false,
      background: '#1e293b',
      color: '#f1f5f9',
      didOpen: () => Swal.showLoading(),
    });

    axios
      .post(`${BASE_URL}/api/topup/verify`, { reference }, { headers: getAuthHeaders() })
      .then((response) => {
        if (response.data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Top-Up Successful!',
            html: `
              <div class="text-left space-y-2">
                <p><strong>Amount:</strong> GHS ${response.data.amount}</p>
                <p><strong>New Balance:</strong> GHS ${response.data.newBalance?.toFixed(2)}</p>
              </div>
            `,
            background: '#1e293b',
            color: '#f1f5f9',
            confirmButtonColor: '#06b6d4',
          });
          if (onSuccess) onSuccess();
        } else if (response.data.pending) {
          Swal.fire({
            icon: 'info',
            title: 'Payment Pending',
            text: response.data.message || 'Payment is still being processed.',
            background: '#1e293b',
            color: '#f1f5f9',
            confirmButtonColor: '#06b6d4',
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'Payment Failed',
            text: response.data.message || 'Could not verify payment',
            background: '#1e293b',
            color: '#f1f5f9',
          });
        }
      })
      .catch((error) => {
        Swal.fire({
          icon: 'error',
          title: 'Verification Error',
          text: error.response?.data?.message || 'Could not verify payment',
          background: '#1e293b',
          color: '#f1f5f9',
        });
      });
  }, [location.pathname, location.search, navigate, onSuccess]);
}
